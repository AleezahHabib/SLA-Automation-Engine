from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.enums import Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.metrics import AgentWorkload
from app.schemas.ticket import AgentSummary

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])


@router.get(
    "",
    response_model=List[AgentSummary],
    summary="List assignable active agents",
)
async def list_assignable_agents(
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> List[AgentSummary]:
    """Retrieve all active users holding the 'agent' role (admin only)."""
    stmt = (
        select(User)
        .where(User.role == Role.AGENT.value, User.is_active.is_(True))
        .order_by(User.full_name.asc(), User.id.asc())
    )
    result = await session.execute(stmt)
    agents = result.scalars().all()

    return [AgentSummary(id=a.id, full_name=a.full_name, email=a.email) for a in agents]


@router.get(
    "/workload",
    response_model=List[AgentWorkload],
    summary="Retrieve current per-agent workload snapshot",
)
async def get_agent_workload(
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> List[AgentWorkload]:
    """Single aggregate SQL query calculating per-agent workload and active breach counts."""
    # Active agents query
    agents_stmt = (
        select(User)
        .where(User.role == Role.AGENT.value, User.is_active.is_(True))
        .order_by(User.full_name.asc())
    )
    agents_res = await session.execute(agents_stmt)
    active_agents = agents_res.scalars().all()

    if not active_agents:
        return []

    # Aggregate counts per agent via conditional COUNT FILTER clauses
    agg_stmt = (
        select(
            Ticket.assigned_agent_id,
            func.count(Ticket.id).label("total_assigned"),
            func.count(Ticket.id).filter(Ticket.status == TicketStatus.OPEN.value).label("open_count"),
            func.count(Ticket.id).filter(Ticket.status == TicketStatus.IN_PROGRESS.value).label("in_progress_count"),
            func.count(Ticket.id).filter(Ticket.status == TicketStatus.RESOLVED.value).label("resolved_count"),
            func.count(Ticket.id).filter(Ticket.status == TicketStatus.CLOSED.value).label("closed_count"),
            func.count(Ticket.id).filter(
                Ticket.sla_breached.is_(True),
                Ticket.status.in_([TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value]),
            ).label("breached_count"),
        )
        .where(Ticket.assigned_agent_id.is_not(None))
        .group_by(Ticket.assigned_agent_id)
    )

    agg_res = await session.execute(agg_stmt)
    stats_by_agent: Dict[str, dict] = {}
    for row in agg_res.all():
        stats_by_agent[str(row[0])] = {
            "total": row[1],
            "by_status": {
                TicketStatus.OPEN.value: row[2],
                TicketStatus.IN_PROGRESS.value: row[3],
                TicketStatus.RESOLVED.value: row[4],
                TicketStatus.CLOSED.value: row[5],
            },
            "breached": row[6],
        }

    workload_list = []
    for agent in active_agents:
        stat = stats_by_agent.get(str(agent.id), {
            "total": 0,
            "by_status": {
                TicketStatus.OPEN.value: 0,
                TicketStatus.IN_PROGRESS.value: 0,
                TicketStatus.RESOLVED.value: 0,
                TicketStatus.CLOSED.value: 0,
            },
            "breached": 0,
        })
        workload_list.append(
            AgentWorkload(
                agent_id=agent.id,
                agent_name=agent.full_name,
                assigned_total=stat["total"],
                by_status=stat["by_status"],
                breached_count=stat["breached"],
            )
        )

    return workload_list
