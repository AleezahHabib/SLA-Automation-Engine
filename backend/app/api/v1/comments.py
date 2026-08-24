import math
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_ticket_access
from app.core.exceptions import ConflictException, ValidationException
from app.models.comment import Comment
from app.models.enums import AuditAction, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.envelope import PaginationEnvelope
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/api/v1/tickets", tags=["Comments"])


def _comment_to_response(comment: Comment) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        ticket_id=comment.ticket_id,
        author_id=comment.author_id,
        author_name=comment.author.full_name,
        author_role=comment.author.role,
        body=comment.body,
        is_internal=comment.is_internal,
        created_at=comment.created_at,
    )


@router.get(
    "/{ticket_id}/comments",
    response_model=PaginationEnvelope[CommentResponse],
    summary="List comments for a ticket",
)
async def list_ticket_comments(
    ticket_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Page size"),
    ticket: Ticket = Depends(require_ticket_access),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PaginationEnvelope[CommentResponse]:
    """Retrieve ticket comments ordered oldest first with customer visibility filtering."""
    page_size = min(max(page_size, 1), 100)

    stmt = (
        select(Comment)
        .where(Comment.ticket_id == ticket_id)
        .options(selectinload(Comment.author))
    )
    count_stmt = select(func.count(Comment.id)).where(Comment.ticket_id == ticket_id)

    # Customer visibility filter in SQL per spec 11 R4b
    if current_user.role == Role.CUSTOMER.value:
        stmt = stmt.where(Comment.is_internal.is_(False))
        count_stmt = count_stmt.where(Comment.is_internal.is_(False))

    # Oldest first per spec 11
    stmt = stmt.order_by(Comment.created_at.asc(), Comment.id.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    total_res = await session.execute(count_stmt)
    total = total_res.scalar_one()

    result = await session.execute(stmt)
    items = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginationEnvelope(
        items=[_comment_to_response(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/{ticket_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a ticket",
)
async def create_comment(
    ticket_id: uuid.UUID,
    req: CommentCreate,
    ticket: Ticket = Depends(require_ticket_access),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CommentResponse:
    """Create a new immutable comment on a ticket."""
    if ticket.status == TicketStatus.CLOSED.value:
        raise ConflictException(
            code="ticket_closed",
            message="Cannot add comments to a closed ticket",
        )

    body_clean = req.body.strip()
    if not body_clean:
        raise ValidationException(
            code="validation_error",
            message="Comment body cannot be empty or whitespace only",
            details=[{"field": "body", "message": "Field required"}],
        )

    if len(body_clean) > 4000:
        raise ValidationException(
            code="validation_error",
            message="Comment body exceeds maximum limit of 4000 characters",
            details=[{"field": "body", "message": "Maximum 4000 characters"}],
        )

    # If customer caller, is_internal is ALWAYS False per spec 11
    if current_user.role == Role.CUSTOMER.value:
        is_internal = False
    else:
        is_internal = req.is_internal

    comment = Comment(
        ticket_id=ticket_id,
        author_id=current_user.id,
        body=body_clean,
        is_internal=is_internal,
    )
    session.add(comment)
    await session.flush()

    # Write audit log in same transaction
    await write_audit_log(
        session=session,
        ticket_id=ticket_id,
        action=AuditAction.COMMENT_ADDED,
        from_value=None,
        to_value=None,
        detail=f"Comment ID: {comment.id} ({'Internal' if is_internal else 'Public'})",
        actor_id=current_user.id,
    )

    await session.commit()

    # Load with author
    res = await session.execute(
        select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.author))
    )
    return _comment_to_response(res.scalar_one())
