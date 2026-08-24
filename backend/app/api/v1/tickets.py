import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.customer import Customer
from app.models.enums import AuditAction, Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.customer import CustomerSummary
from app.schemas.envelope import PaginationEnvelope
from app.schemas.ticket import (
    AgentSummary,
    CustomerTicketCreate,
    StaffTicketCreate,
    TicketAssignmentUpdate,
    TicketListItem,
    TicketPriorityOverride,
    TicketResponse,
    TicketStatusUpdate,
    TicketSummaryCounts,
)
from app.services.audit_service import write_audit_log
from app.services.sla_service import calculate_deadline, triage_ticket
from app.services.ticket_service import (
    assign_ticket,
    can_user_assign,
    can_user_override_priority,
    generate_ticket_reference,
    get_available_transitions,
    override_ticket_priority,
    transition_ticket_status,
)

router = APIRouter(prefix="/api/v1/tickets", tags=["Tickets"])


def _ticket_to_response(ticket: Ticket, user: User) -> TicketResponse:
    # Customer summary is always included
    cust_summary = CustomerSummary(
        id=ticket.customer.id,
        name=ticket.customer.name,
        email=ticket.customer.email,
    )

    # For customer role, assigned_agent is omitted (None) per spec 03 / 09
    agent_summary = None
    if user.role != Role.CUSTOMER.value and ticket.assigned_agent:
        agent_summary = AgentSummary(
            id=ticket.assigned_agent.id,
            full_name=ticket.assigned_agent.full_name,
            email=ticket.assigned_agent.email,
        )

    transitions = get_available_transitions(ticket, user)
    can_assign = can_user_assign(user)
    can_override = can_user_override_priority(user)

    return TicketResponse(
        id=ticket.id,
        reference=ticket.reference,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status,
        priority=ticket.priority,
        customer=cust_summary,
        assigned_agent=agent_summary,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        first_response_at=ticket.first_response_at,
        resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at,
        sla_deadline=ticket.sla_deadline,
        sla_breached=ticket.sla_breached,
        sla_breached_at=ticket.sla_breached_at,
        available_transitions=transitions,
        can_assign=can_assign,
        can_override_priority=can_override,
    )


def _ticket_to_list_item(ticket: Ticket, user: User) -> TicketListItem:
    cust_summary = CustomerSummary(
        id=ticket.customer.id,
        name=ticket.customer.name,
        email=ticket.customer.email,
    )

    agent_summary = None
    if user.role != Role.CUSTOMER.value and ticket.assigned_agent:
        agent_summary = AgentSummary(
            id=ticket.assigned_agent.id,
            full_name=ticket.assigned_agent.full_name,
            email=ticket.assigned_agent.email,
        )

    return TicketListItem(
        id=ticket.id,
        reference=ticket.reference,
        subject=ticket.subject,
        status=ticket.status,
        priority=ticket.priority,
        customer=cust_summary,
        assigned_agent=agent_summary,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        sla_deadline=ticket.sla_deadline,
        sla_breached=ticket.sla_breached,
    )


# -------------------------------------------------------------------------
# 1. SUMMARY ROUTE (Declared BEFORE parameterised /{ticket_id} route per spec 03)
# -------------------------------------------------------------------------
@router.get(
    "/summary",
    response_model=TicketSummaryCounts,
    summary="Current-state ticket counts by status, priority, and breach",
)
async def get_ticket_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TicketSummaryCounts:
    """Return live operational counts scoped to the caller's role."""
    base_filter = []

    if current_user.role == Role.CUSTOMER.value:
        base_filter.append(Ticket.customer_id == current_user.customer_id)
    elif current_user.role == Role.AGENT.value:
        base_filter.append(Ticket.assigned_agent_id == current_user.id)

    # Status counts for all four statuses per spec 15
    status_query = select(
        Ticket.status,
        func.count(Ticket.id),
    ).where(*base_filter).group_by(Ticket.status)

    status_res = await session.execute(status_query)
    by_status: Dict[str, int] = {
        TicketStatus.OPEN.value: 0,
        TicketStatus.IN_PROGRESS.value: 0,
        TicketStatus.RESOLVED.value: 0,
        TicketStatus.CLOSED.value: 0,
    }
    for row in status_res.all():
        by_status[row[0]] = row[1]

    # For customer: omit priority, unassigned, and breached aggregates per spec 03 / 15
    if current_user.role == Role.CUSTOMER.value:
        return TicketSummaryCounts(
            by_status=by_status,
            by_priority=None,
            unassigned=None,
            breached=None,
        )

    # For staff: compute currently breached count (unresolved + breached flag)
    breached_query = select(func.count(Ticket.id)).where(
        *base_filter,
        Ticket.sla_breached.is_(True),
        Ticket.status.in_([TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value]),
    )
    breached_res = await session.execute(breached_query)
    breached_count = breached_res.scalar_one()

    # Agent gets status and own breached count
    if current_user.role == Role.AGENT.value:
        return TicketSummaryCounts(
            by_status=by_status,
            by_priority=None,
            unassigned=None,
            breached=breached_count,
        )

    # Admin gets full org-wide counts (priority breakdown + unassigned count)
    prio_query = select(
        Ticket.priority,
        func.count(Ticket.id),
    ).where(
        Ticket.status.in_([TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value])
    ).group_by(Ticket.priority)

    prio_res = await session.execute(prio_query)
    by_priority: Dict[str, int] = {
        Priority.CRITICAL.value: 0,
        Priority.HIGH.value: 0,
        Priority.MEDIUM.value: 0,
        Priority.LOW.value: 0,
    }
    for row in prio_res.all():
        by_priority[row[0]] = row[1]

    unassigned_query = select(func.count(Ticket.id)).where(
        Ticket.assigned_agent_id.is_(None),
        Ticket.status.in_([TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value]),
    )
    unassigned_res = await session.execute(unassigned_query)
    unassigned_count = unassigned_res.scalar_one()

    return TicketSummaryCounts(
        by_status=by_status,
        by_priority=by_priority,
        unassigned=unassigned_count,
        breached=breached_count,
    )


# -------------------------------------------------------------------------
# 2. LIST & SEARCH TICKETS
# -------------------------------------------------------------------------
@router.get(
    "",
    response_model=PaginationEnvelope[TicketListItem],
    summary="List, filter, search, sort, and paginate tickets",
)
async def list_tickets(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Page size (clamped to 100)"),
    status: Optional[List[str]] = Query(None, description="Filter by status"),
    priority: Optional[List[str]] = Query(None, description="Filter by priority"),
    assigned_agent_id: Optional[uuid.UUID] = Query(None, description="Filter by agent id"),
    assigned_to_me: Optional[bool] = Query(None, description="Scope to caller's assignments"),
    unassigned: Optional[bool] = Query(None, description="Filter unassigned tickets"),
    customer_id: Optional[uuid.UUID] = Query(None, description="Filter by customer id (staff only)"),
    breached: Optional[bool] = Query(None, description="Filter breached tickets"),
    search: Optional[str] = Query(None, description="Search subject and reference"),
    sort_by: str = Query("sla_deadline", description="Sort field: sla_deadline, updated_at, priority, status"),
    sort_order: str = Query("asc", description="Sort order: asc, desc"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PaginationEnvelope[TicketListItem]:
    """Retrieve ticket list with deterministic SQL scoping and pagination."""
    page_size = min(max(page_size, 1), 100)

    stmt = select(Ticket).options(
        selectinload(Ticket.customer),
        selectinload(Ticket.assigned_agent),
    )
    count_stmt = select(func.count(Ticket.id))

    filters = []

    # 1. Tenant Scoping in SQL per spec 04 / 09
    if current_user.role == Role.CUSTOMER.value:
        # Caller is strictly scoped to linked customer; ignore customer_id parameter
        filters.append(Ticket.customer_id == current_user.customer_id)
    elif current_user.role == Role.AGENT.value:
        # Agent sees own tickets and unassigned pool
        filters.append(
            or_(
                Ticket.assigned_agent_id == current_user.id,
                Ticket.assigned_agent_id.is_(None),
            )
        )
    # Admin has no role filter

    # 2. Status filter & Default closed exclusion per spec 09
    valid_statuses = [s.value for s in TicketStatus]
    if status:
        for s in status:
            if s not in valid_statuses:
                raise ValidationException(
                    code="validation_error",
                    message=f"Invalid status filter '{s}'. Valid values: {valid_statuses}",
                    details=[{"field": "status", "message": "Invalid enum value"}],
                )
        filters.append(Ticket.status.in_(status))
    else:
        # Closed tickets are excluded by default
        filters.append(Ticket.status != TicketStatus.CLOSED.value)

    # 3. Priority filter
    valid_priorities = [p.value for p in Priority]
    if priority:
        for p in priority:
            if p not in valid_priorities:
                raise ValidationException(
                    code="validation_error",
                    message=f"Invalid priority filter '{p}'. Valid values: {valid_priorities}",
                    details=[{"field": "priority", "message": "Invalid enum value"}],
                )
        filters.append(Ticket.priority.in_(priority))

    # 4. Assignment filters (Staff only)
    if current_user.role != Role.CUSTOMER.value:
        if assigned_to_me:
            filters.append(Ticket.assigned_agent_id == current_user.id)
        elif unassigned:
            filters.append(Ticket.assigned_agent_id.is_(None))
        elif assigned_agent_id is not None:
            filters.append(Ticket.assigned_agent_id == assigned_agent_id)

    # 5. Customer filter (Staff only)
    if current_user.role != Role.CUSTOMER.value and customer_id is not None:
        filters.append(Ticket.customer_id == customer_id)

    # 6. Breached filter
    if breached is not None:
        filters.append(Ticket.sla_breached.is_(breached))

    # 7. Search filter (subject and reference)
    if search:
        term = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(Ticket.subject).like(term),
                func.lower(Ticket.reference).like(term),
            )
        )

    # Apply all filters
    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    # 8. Sort validation allow-list per spec 09
    allowed_sort_fields = {
        "sla_deadline": Ticket.sla_deadline,
        "updated_at": Ticket.updated_at,
        "created_at": Ticket.created_at,
        "priority": Ticket.priority,
        "status": Ticket.status,
    }
    if sort_by not in allowed_sort_fields:
        raise ValidationException(
            code="validation_error",
            message=f"Invalid sort field '{sort_by}'. Allowed: {list(allowed_sort_fields.keys())}",
            details=[{"field": "sort_by", "message": "Invalid sort field"}],
        )

    sort_col = allowed_sort_fields[sort_by]
    is_desc = sort_order.lower() == "desc"

    # Always append Ticket.id as unique tiebreaker for pagination stability per spec 02 / 09
    if is_desc:
        stmt = stmt.order_by(sort_col.desc(), Ticket.id.asc())
    else:
        stmt = stmt.order_by(sort_col.asc(), Ticket.id.asc())

    # Pagination
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    total_res = await session.execute(count_stmt)
    total = total_res.scalar_one()

    result = await session.execute(stmt)
    items = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginationEnvelope(
        items=[_ticket_to_list_item(t, current_user) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# -------------------------------------------------------------------------
# 3. CREATE TICKET
# -------------------------------------------------------------------------
@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new support ticket",
)
async def create_ticket(
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Create a ticket with server-side priority scoring and SLA deadline generation."""
    subject = str(body.get("subject", "")).strip()
    description = str(body.get("description", "")).strip()

    if not subject:
        raise ValidationException(
            code="validation_error",
            message="Subject is required",
            details=[{"field": "subject", "message": "Field required"}],
        )
    if not description:
        raise ValidationException(
            code="validation_error",
            message="Description is required",
            details=[{"field": "description", "message": "Field required"}],
        )

    # Determine customer_id based on role
    if current_user.role == Role.CUSTOMER.value:
        # Customer caller: derive strictly from session per spec 09
        target_customer_id = current_user.customer_id
    else:
        # Staff caller: customer_id is required in body
        cust_id_raw = body.get("customer_id")
        if not cust_id_raw:
            raise ValidationException(
                code="validation_error",
                message="customer_id is required for staff ticket intake",
                details=[{"field": "customer_id", "message": "Field required"}],
            )
        try:
            target_customer_id = uuid.UUID(str(cust_id_raw))
        except ValueError:
            raise ValidationException(
                code="validation_error",
                message="Invalid customer_id format",
                details=[{"field": "customer_id", "message": "Invalid UUID"}],
            )

    # Validate customer exists and is not archived
    cust_res = await session.execute(
        select(Customer).where(Customer.id == target_customer_id)
    )
    customer = cust_res.scalar_one_or_none()

    if not customer:
        raise ValidationException(
            code="validation_error",
            message="Referenced customer does not exist",
            details=[{"field": "customer_id", "message": "Customer not found"}],
        )

    if customer.is_archived:
        raise ValidationException(
            code="validation_error",
            message="Cannot create ticket for an archived customer",
            details=[{"field": "customer_id", "message": "Customer is archived"}],
        )

    now = datetime.now(timezone.utc)

    # 1. Deterministic triage scoring
    priority, triage_version = triage_ticket(subject, description)

    # 2. SLA deadline computation from created_at
    deadline = calculate_deadline(now, priority)

    # 3. Generate human reference
    reference = await generate_ticket_reference(session)

    # 4. Create Ticket record
    ticket = Ticket(
        reference=reference,
        customer_id=customer.id,
        subject=subject,
        description=description,
        status=TicketStatus.OPEN.value,
        priority=priority.value,
        assigned_agent_id=None,
        created_at=now,
        updated_at=now,
        first_response_at=None,
        resolved_at=None,
        closed_at=None,
        sla_deadline=deadline,
        sla_breached=False,
        sla_breached_at=None,
    )
    session.add(ticket)
    await session.flush()

    # 5. Write creation audit entry in same transaction
    await write_audit_log(
        session=session,
        ticket_id=ticket.id,
        action=AuditAction.TICKET_CREATED,
        from_value=None,
        to_value=TicketStatus.OPEN.value,
        detail=f"Triage rule version: {triage_version}, Priority: {priority.value}, SLA: {deadline.isoformat()}",
        actor_id=current_user.id,
    )

    await session.commit()

    # Re-fetch ticket with joined relations
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    res = await session.execute(stmt)
    loaded_ticket = res.scalar_one()

    return _ticket_to_response(loaded_ticket, current_user)


# -------------------------------------------------------------------------
# 4. READ SINGLE TICKET
# -------------------------------------------------------------------------
@router.get(
    "/{ticket_id}",
    response_model=TicketResponse,
    summary="Retrieve single ticket detail",
)
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Retrieve single ticket with dynamic capability flags and tenant scoping."""
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    res = await session.execute(stmt)
    ticket = res.scalar_one_or_none()

    if not ticket:
        raise NotFoundException(code="not_found", message="Ticket not found")

    # Authorisation & Scoping checks (return 404 on cross-tenant to prevent probing)
    if current_user.role == Role.CUSTOMER.value:
        if ticket.customer_id != current_user.customer_id:
            raise NotFoundException(code="not_found", message="Ticket not found")
    elif current_user.role == Role.AGENT.value:
        if ticket.assigned_agent_id is not None and ticket.assigned_agent_id != current_user.id:
            raise NotFoundException(code="not_found", message="Ticket not found")

    return _ticket_to_response(ticket, current_user)


# -------------------------------------------------------------------------
# 5. STATUS TRANSITION
# -------------------------------------------------------------------------
@router.patch(
    "/{ticket_id}/status",
    response_model=TicketResponse,
    summary="Perform a state machine transition",
)
async def update_ticket_status(
    ticket_id: uuid.UUID,
    req: TicketStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Move a ticket through the linear state machine with row-level concurrency lock."""
    ticket = await transition_ticket_status(
        session=session,
        ticket_id=ticket_id,
        target_status=req.status,
        actor=current_user,
    )
    await session.commit()

    # Re-read with relations
    res = await session.execute(
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    return _ticket_to_response(res.scalar_one(), current_user)


# -------------------------------------------------------------------------
# 6. ASSIGNMENT MUTATION
# -------------------------------------------------------------------------
@router.patch(
    "/{ticket_id}/assignment",
    response_model=TicketResponse,
    summary="Assign, reassign, or clear ticket assignment",
)
async def update_ticket_assignment(
    ticket_id: uuid.UUID,
    req: TicketAssignmentUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Assign, reassign, or unassign an agent (admin only)."""
    ticket = await assign_ticket(
        session=session,
        ticket_id=ticket_id,
        agent_id=req.assigned_agent_id,
        actor=current_user,
    )
    await session.commit()

    res = await session.execute(
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    return _ticket_to_response(res.scalar_one(), current_user)


# -------------------------------------------------------------------------
# 7. PRIORITY OVERRIDE
# -------------------------------------------------------------------------
@router.patch(
    "/{ticket_id}/priority",
    response_model=TicketResponse,
    summary="Override ticket priority and recompute SLA deadline",
)
async def update_ticket_priority(
    ticket_id: uuid.UUID,
    req: TicketPriorityOverride,
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> TicketResponse:
    """Override priority and recalculate SLA deadline from creation timestamp (admin only)."""
    ticket = await override_ticket_priority(
        session=session,
        ticket_id=ticket_id,
        new_priority=req.priority,
        actor=current_user,
    )
    await session.commit()

    res = await session.execute(
        select(Ticket)
        .where(Ticket.id == ticket.id)
        .options(selectinload(Ticket.customer), selectinload(Ticket.assigned_agent))
    )
    return _ticket_to_response(res.scalar_one(), current_user)
