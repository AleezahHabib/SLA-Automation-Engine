import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_ticket_access
from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    PayloadTooLargeException,
    UnsupportedMediaTypeException,
    ValidationException,
)
from app.models.attachment import Attachment, AttachmentBlob
from app.models.enums import AuditAction, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.attachment import AttachmentResponse
from app.services.audit_service import write_audit_log

router = APIRouter(tags=["Attachments"])


def _attachment_to_response(att: Attachment) -> AttachmentResponse:
    return AttachmentResponse(
        id=att.id,
        ticket_id=att.ticket_id,
        uploaded_by_id=att.uploaded_by_id,
        uploaded_by_name=att.uploaded_by.full_name,
        original_filename=att.original_filename,
        storage_key=att.storage_key,
        content_type=att.content_type,
        size_bytes=att.size_bytes,
        is_customer_visible=att.is_customer_visible,
        created_at=att.created_at,
    )


def _detect_content_type(header_bytes: bytes, filename: str) -> Optional[str]:
    """Inspect magic numbers to verify file content type per spec 12."""
    if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if header_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if header_bytes.startswith(b"GIF87a") or header_bytes.startswith(b"GIF89a"):
        return "image/gif"
    if header_bytes.startswith(b"RIFF") and len(header_bytes) >= 12 and header_bytes[8:12] == b"WEBP":
        return "image/webp"
    if header_bytes.startswith(b"%PDF-"):
        return "application/pdf"
    if header_bytes.startswith(b"PK\x03\x04") or header_bytes.startswith(b"PK\x05\x06"):
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext == ".xlsx":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return "application/zip"

    # Check for plain text or CSV
    try:
        header_bytes.decode("utf-8")
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".csv":
            return "text/csv"
        return "text/plain"
    except UnicodeDecodeError:
        pass

    return None


@router.get(
    "/api/v1/tickets/{ticket_id}/attachments",
    response_model=List[AttachmentResponse],
    summary="List attachments for a ticket",
)
async def list_ticket_attachments(
    ticket_id: uuid.UUID,
    ticket: Ticket = Depends(require_ticket_access),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> List[AttachmentResponse]:
    """List attachments with customer visibility filter."""
    stmt = (
        select(Attachment)
        .where(Attachment.ticket_id == ticket_id)
        .options(selectinload(Attachment.uploaded_by))
    )

    if current_user.role == Role.CUSTOMER.value:
        stmt = stmt.where(Attachment.is_customer_visible.is_(True))

    stmt = stmt.order_by(Attachment.created_at.asc(), Attachment.id.asc())
    result = await session.execute(stmt)
    attachments = result.scalars().all()

    return [_attachment_to_response(a) for a in attachments]


@router.post(
    "/api/v1/tickets/{ticket_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an attachment to a ticket",
)
async def upload_attachment(
    ticket_id: uuid.UUID,
    file: UploadFile = File(..., description="The binary file to upload"),
    is_customer_visible: bool = Form(False, description="Visible to customer (staff only)"),
    ticket: Ticket = Depends(require_ticket_access),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AttachmentResponse:
    """Upload one file, validate size/content-type, and store transactionally."""
    if ticket.status == TicketStatus.CLOSED.value:
        raise ConflictException(code="ticket_closed", message="Cannot upload attachments to a closed ticket")

    # 1. Quota check: per-ticket count
    count_res = await session.execute(
        select(func.count(Attachment.id)).where(Attachment.ticket_id == ticket_id)
    )
    existing_count = count_res.scalar_one()
    if existing_count >= settings.MAX_ATTACHMENTS_PER_TICKET:
        raise ValidationException(
            code="attachment_quota_exceeded",
            message=f"Maximum limit of {settings.MAX_ATTACHMENTS_PER_TICKET} attachments per ticket reached",
        )

    # 2. Read content into memory up to max file size
    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_UPLOAD_BYTES:
        raise PayloadTooLargeException(
            code="payload_too_large",
            message=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    # 3. Quota check: total size per ticket
    total_size_res = await session.execute(
        select(func.coalesce(func.sum(Attachment.size_bytes), 0)).where(Attachment.ticket_id == ticket_id)
    )
    existing_total_size = total_size_res.scalar_one()
    if existing_total_size + file_size > settings.MAX_TOTAL_ATTACHMENT_BYTES_PER_TICKET:
        raise ValidationException(
            code="attachment_quota_exceeded",
            message="Total attachment size for this ticket exceeds 20 MB quota",
        )

    # 4. Content-type inspection and validation
    detected_type = _detect_content_type(content[:512], file.filename or "")
    if not detected_type:
        raise UnsupportedMediaTypeException(
            code="unsupported_media_type",
            message="File format is not supported",
        )

    # If customer caller, visibility is ALWAYS True per spec 12
    if current_user.role == Role.CUSTOMER.value:
        visible = True
    else:
        visible = is_customer_visible

    # Generate isolated storage key
    storage_key = f"att_{uuid.uuid4().hex}"
    filename = os.path.basename(file.filename or "attachment")

    # 5. Insert metadata and blob in same transaction per spec 12 R3
    attachment = Attachment(
        ticket_id=ticket_id,
        uploaded_by_id=current_user.id,
        original_filename=filename,
        storage_key=storage_key,
        content_type=detected_type,
        size_bytes=file_size,
        is_customer_visible=visible,
    )
    session.add(attachment)

    blob = AttachmentBlob(
        storage_key=storage_key,
        data=content,
    )
    session.add(blob)

    await session.flush()

    # 6. Audit log entry
    await write_audit_log(
        session=session,
        ticket_id=ticket_id,
        action=AuditAction.ATTACHMENT_ADDED,
        from_value=None,
        to_value=None,
        detail=f"Attachment: {filename} ({detected_type}, {file_size} bytes, {'Customer-visible' if visible else 'Internal'})",
        actor_id=current_user.id,
    )

    await session.commit()

    res = await session.execute(
        select(Attachment).where(Attachment.id == attachment.id).options(selectinload(Attachment.uploaded_by))
    )
    return _attachment_to_response(res.scalar_one())


@router.get(
    "/api/v1/attachments/{attachment_id}/content",
    summary="Download an attachment's binary content",
)
async def download_attachment_content(
    attachment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Stream attachment binary data with security headers and authorization checks."""
    stmt = (
        select(Attachment)
        .where(Attachment.id == attachment_id)
        .options(selectinload(Attachment.ticket), selectinload(Attachment.blob))
    )
    res = await session.execute(stmt)
    att = res.scalar_one_or_none()

    if not att or not att.blob:
        raise NotFoundException(code="not_found", message="Attachment not found")

    ticket = att.ticket

    # Scoping check per spec 04 / 12
    if current_user.role == Role.CUSTOMER.value:
        if ticket.customer_id != current_user.customer_id or not att.is_customer_visible:
            raise NotFoundException(code="not_found", message="Attachment not found")
    elif current_user.role == Role.AGENT.value:
        if ticket.assigned_agent_id is not None and ticket.assigned_agent_id != current_user.id:
            raise NotFoundException(code="not_found", message="Attachment not found")

    headers = {
        "Content-Disposition": f'attachment; filename="{att.original_filename}"',
        "X-Content-Type-Options": "nosniff",
    }

    return Response(
        content=att.blob.data,
        media_type=att.content_type,
        headers=headers,
    )
