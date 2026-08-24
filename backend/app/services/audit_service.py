import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.enums import AuditAction


async def write_audit_log(
    session: AsyncSession,
    ticket_id: uuid.UUID,
    action: AuditAction,
    from_value: Optional[str] = None,
    to_value: Optional[str] = None,
    detail: Optional[str] = None,
    actor_id: Optional[uuid.UUID] = None,
) -> AuditLog:
    """Create and attach an AuditLog entry within the caller's active database transaction."""
    audit_entry = AuditLog(
        ticket_id=ticket_id,
        actor_id=actor_id,
        action=action.value if hasattr(action, "value") else action,
        from_value=from_value,
        to_value=to_value,
        detail=detail,
    )
    session.add(audit_entry)
    # Flush so audit_entry receives generated attributes without committing the transaction
    await session.flush()
    return audit_entry
