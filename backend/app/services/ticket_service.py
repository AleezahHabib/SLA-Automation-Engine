import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.enums import AuditAction, Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.services.audit_service import write_audit_log
from app.services.sla_service import calculate_deadline, is_ticket_breached


async def generate_ticket_reference(session: AsyncSession) -> str:
    """Generate the next human-readable reference from the database sequence (e.g. TKT-000042)."""
    try:
        result = await session.execute(text("SELECT nextval('ticket_reference_seq')"))
        seq_val = result.scalar_one()
    except Exception:
        # Fallback for SQLite / non-PostgreSQL testing environments
        count_res = await session.execute(select(func.count(Ticket.id)))
        seq_val = count_res.scalar_one() + 1
    return f"TKT-{seq_val:06d}"


def get_available_transitions(ticket: Ticket, user: User) -> List[str]:
    """Compute available status transitions permitted for this user on this ticket."""
    if user.role == Role.CUSTOMER.value:
        return []

    status = ticket.status

    if user.role == Role.AGENT.value:
        # Agent must be the assignee to perform transitions
        if ticket.assigned_agent_id != user.id:
            return []
        if status == TicketStatus.OPEN.value:
            return [TicketStatus.IN_PROGRESS.value]
        elif status == TicketStatus.IN_PROGRESS.value:
            return [TicketStatus.RESOLVED.value]
        return []

    if user.role == Role.ADMIN.value:
        if status == TicketStatus.OPEN.value:
            # Precondition: must have an assigned agent before starting work
            if ticket.assigned_agent_id is not None:
                return [TicketStatus.IN_PROGRESS.value]
            return []
        elif status == TicketStatus.IN_PROGRESS.value:
            return [TicketStatus.RESOLVED.value]
        elif status == TicketStatus.RESOLVED.value:
            return [TicketStatus.CLOSED.value]
        return []

    return []


def can_user_assign(user: User) -> bool:
    """Check if the user has permission to assign/reassign tickets (admin only)."""
    return user.role == Role.ADMIN.value


def can_user_override_priority(user: User) -> bool:
    """Check if the user has permission to override ticket priority (admin only)."""
    return user.role == Role.ADMIN.value


async def transition_ticket_status(
    session: AsyncSession,
    ticket_id: uuid.UUID,
    target_status: TicketStatus,
    actor: User,
) -> Ticket:
    """Execute an atomic status transition under a row lock with audit recording."""
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    # Apply row lock if supported by database engine
    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    result = await session.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise NotFoundException(code="not_found", message="Ticket not found")

    current_status = ticket.status
    target_val = target_status.value if hasattr(target_status, "value") else target_status

    # 1. Check self-transition
    if current_status == target_val:
        raise ConflictException(
            code="illegal_transition",
            message=f"Ticket is already in status '{current_status}'",
            details=[{"field": "status", "message": "Self-transition not permitted", "current_status": current_status}],
        )

    # 2. Check closed terminal rule
    if current_status == TicketStatus.CLOSED.value:
        raise ConflictException(
            code="illegal_transition",
            message="Closed tickets are terminal and cannot be reopened or transitioned",
            details=[{"field": "status", "message": "Closed is terminal", "current_status": current_status}],
        )

    # 3. Validate transition table legality
    legal = False
    if current_status == TicketStatus.OPEN.value and target_val == TicketStatus.IN_PROGRESS.value:
        legal = True
        # State Guard: open -> in_progress requires assigned agent
        if ticket.assigned_agent_id is None:
            raise ConflictException(
                code="illegal_transition",
                message="Ticket must have an assigned agent before moving to 'in_progress'",
                details=[{"field": "assigned_agent_id", "message": "Assignee required", "current_status": current_status}],
            )
    elif current_status == TicketStatus.IN_PROGRESS.value and target_val == TicketStatus.RESOLVED.value:
        legal = True
    elif current_status == TicketStatus.RESOLVED.value and target_val == TicketStatus.CLOSED.value:
        legal = True

    if not legal:
        raise ConflictException(
            code="illegal_transition",
            message=f"Illegal transition from '{current_status}' to '{target_val}'",
            details=[{"field": "status", "message": "Transition not permitted", "current_status": current_status}],
        )

    # 4. Check actor permissions per spec 04
    if actor.role == Role.CUSTOMER.value:
        raise ForbiddenException(code="forbidden", message="Customers cannot perform status transitions")
    elif actor.role == Role.AGENT.value:
        if ticket.assigned_agent_id != actor.id:
            raise ForbiddenException(code="forbidden", message="Agents may only transition tickets assigned to them")
        if target_val == TicketStatus.CLOSED.value:
            raise ForbiddenException(code="forbidden", message="Only administrators can close tickets")

    # 5. Apply state effects
    now = datetime.now(timezone.utc)
    from_status = current_status
    ticket.status = target_val
    ticket.updated_at = now

    closure_detail = None
    if target_val == TicketStatus.IN_PROGRESS.value:
        if ticket.first_response_at is None:
            ticket.first_response_at = now
    elif target_val == TicketStatus.RESOLVED.value:
        ticket.resolved_at = now
        # Finalize SLA breach state on resolution per spec 06
        if ticket.resolved_at > ticket.sla_deadline:
            ticket.sla_breached = True
            if ticket.sla_breached_at is None:
                ticket.sla_breached_at = ticket.resolved_at
    elif target_val == TicketStatus.CLOSED.value:
        ticket.closed_at = now
        outcome = "Breached" if ticket.sla_breached else "Met"
        resolved_str = ticket.resolved_at.isoformat() if ticket.resolved_at else "N/A"
        closure_detail = (
            f"Ticket closed administratively. Final SLA outcome: {outcome}. "
            f"Deadline: {ticket.sla_deadline.isoformat()}, Resolved at: {resolved_str}"
        )

    # 6. Record audit log in same transaction
    await write_audit_log(
        session=session,
        ticket_id=ticket.id,
        action=AuditAction.STATUS_CHANGED,
        from_value=from_status,
        to_value=target_val,
        detail=closure_detail,
        actor_id=actor.id,
    )

    await session.flush()
    return ticket


async def override_ticket_priority(
    session: AsyncSession,
    ticket_id: uuid.UUID,
    new_priority: Priority,
    actor: User,
) -> Ticket:
    """Override ticket priority (admin only), recomputing deadline from original created_at."""
    if actor.role != Role.ADMIN.value:
        raise ForbiddenException(code="forbidden", message="Only administrators can override ticket priority")

    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    result = await session.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise NotFoundException(code="not_found", message="Ticket not found")

    if ticket.status == TicketStatus.CLOSED.value:
        raise ConflictException(code="conflict", message="Cannot change priority on a closed ticket")

    new_prio_val = new_priority.value if hasattr(new_priority, "value") else new_priority
    if ticket.priority == new_prio_val:
        raise ConflictException(code="conflict", message=f"Ticket priority is already '{new_prio_val}'")

    from_prio = ticket.priority
    ticket.priority = new_prio_val
    ticket.updated_at = datetime.now(timezone.utc)

    # Recalculate deadline from original created_at per spec 06
    ticket.sla_deadline = calculate_deadline(ticket.created_at, new_priority)

    # If new deadline is in the past, mark breached immediately per spec 06
    now = datetime.now(timezone.utc)
    if is_ticket_breached(ticket, now):
        ticket.sla_breached = True
        if ticket.sla_breached_at is None:
            ticket.sla_breached_at = now

    # Write audit log
    await write_audit_log(
        session=session,
        ticket_id=ticket.id,
        action=AuditAction.PRIORITY_OVERRIDDEN,
        from_value=from_prio,
        to_value=new_prio_val,
        detail=f"Recomputed SLA deadline: {ticket.sla_deadline.isoformat()}",
        actor_id=actor.id,
    )

    await session.flush()
    return ticket


async def assign_ticket(
    session: AsyncSession,
    ticket_id: uuid.UUID,
    agent_id: Optional[uuid.UUID],
    actor: User,
) -> Ticket:
    """Assign, reassign, or clear ticket assignment (admin only)."""
    if actor.role != Role.ADMIN.value:
        raise ForbiddenException(code="forbidden", message="Only administrators can assign tickets")

    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    if session.bind and session.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    result = await session.execute(stmt)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise NotFoundException(code="not_found", message="Ticket not found")

    if ticket.status == TicketStatus.CLOSED.value:
        raise ConflictException(code="conflict", message="Cannot change assignment on a closed ticket")

    if ticket.assigned_agent_id == agent_id:
        msg = "Ticket is already assigned to this agent" if agent_id else "Ticket is already unassigned"
        raise ConflictException(code="conflict", message=msg)

    # Clearing assignment while in_progress is forbidden per spec 10
    if ticket.status == TicketStatus.IN_PROGRESS.value and agent_id is None:
        raise ConflictException(
            code="conflict",
            message="Cannot clear assignment while ticket is in progress; reassign to another agent instead",
        )

    prev_agent_name = ticket.assigned_agent.full_name if ticket.assigned_agent else None
    target_agent_name = None

    if agent_id is not None:
        agent_res = await session.execute(select(User).where(User.id == agent_id))
        target_agent = agent_res.scalar_one_or_none()

        if not target_agent or not target_agent.is_active:
            raise ValidationException(
                code="validation_error",
                message="Target agent not found or is inactive",
                details=[{"field": "assigned_agent_id", "message": "Agent is invalid or inactive"}],
            )

        if target_agent.role != Role.AGENT.value:
            raise ValidationException(
                code="validation_error",
                message="Only users with the 'agent' role can receive assignments",
                details=[{"field": "assigned_agent_id", "message": "Target user is not an agent"}],
            )

        target_agent_name = target_agent.full_name
        ticket.assigned_agent_id = agent_id
        ticket.assigned_agent = target_agent
        action = AuditAction.ASSIGNED
    else:
        ticket.assigned_agent_id = None
        ticket.assigned_agent = None
        action = AuditAction.UNASSIGNED

    ticket.updated_at = datetime.now(timezone.utc)

    # Record audit log
    await write_audit_log(
        session=session,
        ticket_id=ticket.id,
        action=action,
        from_value=prev_agent_name,
        to_value=target_agent_name,
        detail=None,
        actor_id=actor.id,
    )

    await session.flush()
    return ticket
