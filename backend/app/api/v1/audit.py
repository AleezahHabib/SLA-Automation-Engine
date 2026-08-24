import math
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.exceptions import NotFoundException
from app.models.audit_log import AuditLog
from app.models.enums import Role
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.envelope import PaginationEnvelope

router = APIRouter(prefix="/api/v1/tickets", tags=["Audit Log"])


def _audit_to_response(log: AuditLog) -> AuditLogResponse:
    actor_name = log.actor.full_name if log.actor else "System (SLA Worker)"
    return AuditLogResponse(
        id=log.id,
        ticket_id=log.ticket_id,
        actor_id=log.actor_id,
        actor_name=actor_name,
        action=log.action,
        from_value=log.from_value,
        to_value=log.to_value,
        detail=log.detail,
        created_at=log.created_at,
    )


@router.get(
    "/{ticket_id}/audit",
    response_model=PaginationEnvelope[AuditLogResponse],
    summary="Retrieve ticket audit trail",
)
async def get_ticket_audit_log(
    ticket_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Page size"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> PaginationEnvelope[AuditLogResponse]:
    """Retrieve audit entries for a ticket ordered oldest first (admin only)."""
    page_size = min(max(page_size, 1), 100)

    # Check ticket exists
    ticket_res = await session.execute(select(Ticket).where(Ticket.id == ticket_id))
    if not ticket_res.scalar_one_or_none():
        raise NotFoundException(code="not_found", message="Ticket not found")

    stmt = (
        select(AuditLog)
        .where(AuditLog.ticket_id == ticket_id)
        .options(selectinload(AuditLog.actor))
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    count_stmt = select(func.count(AuditLog.id)).where(AuditLog.ticket_id == ticket_id)

    total_res = await session.execute(count_stmt)
    total = total_res.scalar_one()

    result = await session.execute(stmt)
    items = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginationEnvelope(
        items=[_audit_to_response(log) for log in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
