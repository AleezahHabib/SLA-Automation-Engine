import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import AuditAction, TicketStatus
from app.models.ticket import Ticket
from app.services.audit_service import write_audit_log

logger = logging.getLogger("sla_worker")


async def process_due_sla_breaches(session: AsyncSession) -> int:
    """Scan and process due breached tickets using concurrency-safe row locking (SKIP LOCKED).
    
    Returns the number of tickets flagged in this batch.
    """
    now = datetime.now(timezone.utc)

    # Hot query served by composite index on (status, sla_deadline) per spec 02 / 13
    stmt = (
        select(Ticket)
        .where(
            Ticket.sla_deadline <= now,
            Ticket.sla_breached.is_(False),
            Ticket.status.in_([TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value]),
        )
        .order_by(Ticket.sla_deadline.asc())
        .limit(50)
    )

    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)

    result = await session.execute(stmt)
    due_tickets = result.scalars().all()

    if not due_tickets:
        return 0

    count = 0
    for ticket in due_tickets:
        ticket.sla_breached = True
        ticket.sla_breached_at = now
        ticket.updated_at = now

        # Write audit log with actor_id=None per spec 13 / 14 (null signifies background worker)
        await write_audit_log(
            session=session,
            ticket_id=ticket.id,
            action=AuditAction.SLA_BREACHED,
            from_value=None,
            to_value=None,
            detail=f"SLA deadline breached. Deadline was {ticket.sla_deadline.isoformat()}, detected at {now.isoformat()}",
            actor_id=None,
        )
        count += 1

    await session.commit()
    logger.info(f"SLA worker flagged {count} overdue tickets as breached.")
    return count


async def sla_worker_loop(interval_seconds: Optional[int] = None) -> None:
    """Asyncio background task waking on fixed interval to detect SLA breaches."""
    interval = interval_seconds or settings.SLA_WORKER_INTERVAL_SECONDS
    logger.info(f"SLA monitor worker started. Polling interval: {interval}s")

    while True:
        try:
            async with AsyncSessionLocal() as session:
                try:
                    await process_due_sla_breaches(session)
                except Exception as e:
                    await session.rollback()
                    logger.error(f"Error during SLA worker cycle: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Failed to acquire session in SLA worker loop: {e}", exc_info=True)

        await asyncio.sleep(interval)
