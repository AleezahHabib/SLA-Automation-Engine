import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.exceptions import ValidationException
from app.models.enums import Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.metrics import (
    MetricsByAgentItem,
    MetricsByPriorityItem,
    MetricsSummary,
    TimeseriesBucket,
    TimeseriesResponse,
)
from app.services.sla_service import calculate_compliance_rate

router = APIRouter(prefix="/api/v1/metrics", tags=["Metrics"])


def _validate_window(start_time: datetime, end_time: datetime) -> None:
    if start_time >= end_time:
        raise ValidationException(
            code="validation_error",
            message="start_time must be earlier than end_time",
            details=[
                {"field": "start_time", "message": "Must precede end_time"},
                {"field": "end_time", "message": "Must follow start_time"},
            ],
        )


@router.get(
    "/summary",
    response_model=MetricsSummary,
    summary="Windowed SLA metrics summary",
)
async def get_metrics_summary(
    start_time: datetime = Query(..., description="Start of historical window (ISO-8601 UTC)"),
    end_time: datetime = Query(..., description="End of historical window (ISO-8601 UTC)"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> MetricsSummary:
    """Historical aggregate reporting over tickets created within the window (admin only)."""
    _validate_window(start_time, end_time)
    now = datetime.now(timezone.utc)

    # Base query for tickets created in window
    stmt = select(Ticket).where(
        Ticket.created_at >= start_time,
        Ticket.created_at <= end_time,
    )
    result = await session.execute(stmt)
    tickets = result.scalars().all()

    created_count = len(tickets)
    resolved_count = 0
    closed_count = 0
    met_count = 0
    missed_count = 0
    resolution_durations_minutes: List[float] = []

    for t in tickets:
        if t.resolved_at is not None:
            resolved_count += 1
            duration = (t.resolved_at - t.created_at).total_seconds() / 60.0
            if duration >= 0:
                resolution_durations_minutes.append(duration)

            if t.resolved_at <= t.sla_deadline:
                met_count += 1
            else:
                missed_count += 1
        elif now > t.sla_deadline:
            # Overdue unresolved tickets count as missed per spec 06 / 15
            missed_count += 1

        if t.closed_at is not None:
            closed_count += 1

    compliance = calculate_compliance_rate(met_count, missed_count)

    # Median and P90 calculation
    median_tt_res = None
    p90_tt_res = None
    if resolution_durations_minutes:
        sorted_durations = sorted(resolution_durations_minutes)
        n = len(sorted_durations)

        # Median
        mid = n // 2
        if n % 2 == 1:
            median_tt_res = round(sorted_durations[mid], 2)
        else:
            median_tt_res = round((sorted_durations[mid - 1] + sorted_durations[mid]) / 2.0, 2)

        # 90th percentile
        p90_idx = int(math.ceil(0.90 * n)) - 1
        p90_tt_res = round(sorted_durations[min(max(p90_idx, 0), n - 1)], 2)

    return MetricsSummary(
        window_start=start_time,
        window_end=end_time,
        created_count=created_count,
        resolved_count=resolved_count,
        closed_count=closed_count,
        met_count=met_count,
        missed_count=missed_count,
        compliance_rate=compliance,
        median_time_to_resolution_minutes=median_tt_res,
        p90_time_to_resolution_minutes=p90_tt_res,
    )


@router.get(
    "/by-priority",
    response_model=List[MetricsByPriorityItem],
    summary="Windowed metrics breakdown by priority",
)
async def get_metrics_by_priority(
    start_time: datetime = Query(..., description="Start of window"),
    end_time: datetime = Query(..., description="End of window"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> List[MetricsByPriorityItem]:
    """Breakdown of creation, resolution, and compliance by priority level (admin only)."""
    _validate_window(start_time, end_time)
    now = datetime.now(timezone.utc)

    stmt = select(Ticket).where(
        Ticket.created_at >= start_time,
        Ticket.created_at <= end_time,
    )
    result = await session.execute(stmt)
    tickets = result.scalars().all()

    prio_map: dict[str, dict] = {
        p.value: {
            "created": 0,
            "resolved": 0,
            "met": 0,
            "missed": 0,
            "durations": [],
        }
        for p in Priority
    }

    for t in tickets:
        p = t.priority
        if p in prio_map:
            prio_map[p]["created"] += 1
            if t.resolved_at is not None:
                prio_map[p]["resolved"] += 1
                dur = (t.resolved_at - t.created_at).total_seconds() / 60.0
                if dur >= 0:
                    prio_map[p]["durations"].append(dur)
                if t.resolved_at <= t.sla_deadline:
                    prio_map[p]["met"] += 1
                else:
                    prio_map[p]["missed"] += 1
            elif now > t.sla_deadline:
                prio_map[p]["missed"] += 1

    items = []
    for prio in [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]:
        stat = prio_map[prio.value]
        compliance = calculate_compliance_rate(stat["met"], stat["missed"])
        median_dur = None
        if stat["durations"]:
            sorted_d = sorted(stat["durations"])
            m = len(sorted_d) // 2
            median_dur = round(sorted_d[m] if len(sorted_d) % 2 == 1 else (sorted_d[m - 1] + sorted_d[m]) / 2.0, 2)

        items.append(
            MetricsByPriorityItem(
                priority=prio.value,
                created_count=stat["created"],
                resolved_count=stat["resolved"],
                met_count=stat["met"],
                missed_count=stat["missed"],
                compliance_rate=compliance,
                median_time_to_resolution_minutes=median_dur,
            )
        )

    return items


@router.get(
    "/by-agent",
    response_model=List[MetricsByAgentItem],
    summary="Windowed metrics breakdown by agent",
)
async def get_metrics_by_agent(
    start_time: datetime = Query(..., description="Start of window"),
    end_time: datetime = Query(..., description="End of window"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> List[MetricsByAgentItem]:
    """Breakdown of agent resolution performance within the window (admin only)."""
    _validate_window(start_time, end_time)

    # Get active agents
    agents_res = await session.execute(
        select(User).where(User.role == Role.AGENT.value, User.is_active.is_(True)).order_by(User.full_name.asc())
    )
    agents = agents_res.scalars().all()

    # Query resolved tickets assigned to agents in the window
    stmt = select(Ticket).where(
        Ticket.created_at >= start_time,
        Ticket.created_at <= end_time,
        Ticket.assigned_agent_id.is_not(None),
    )
    res = await session.execute(stmt)
    tickets = res.scalars().all()

    agent_stats: dict[str, dict] = {
        str(a.id): {"name": a.full_name, "resolved": 0, "met": 0, "missed": 0, "durations": []}
        for a in agents
    }

    for t in tickets:
        agent_id_str = str(t.assigned_agent_id)
        if agent_id_str in agent_stats and t.resolved_at is not None:
            agent_stats[agent_id_str]["resolved"] += 1
            dur = (t.resolved_at - t.created_at).total_seconds() / 60.0
            if dur >= 0:
                agent_stats[agent_id_str]["durations"].append(dur)
            if t.resolved_at <= t.sla_deadline:
                agent_stats[agent_id_str]["met"] += 1
            else:
                agent_stats[agent_id_str]["missed"] += 1

    items = []
    for agent in agents:
        stat = agent_stats[str(agent.id)]
        compliance = calculate_compliance_rate(stat["met"], stat["missed"])
        median_dur = None
        if stat["durations"]:
            sorted_d = sorted(stat["durations"])
            m = len(sorted_d) // 2
            median_dur = round(sorted_d[m] if len(sorted_d) % 2 == 1 else (sorted_d[m - 1] + sorted_d[m]) / 2.0, 2)

        items.append(
            MetricsByAgentItem(
                agent_id=agent.id,
                agent_name=agent.full_name,
                resolved_count=stat["resolved"],
                met_count=stat["met"],
                missed_count=stat["missed"],
                compliance_rate=compliance,
                median_time_to_resolution_minutes=median_dur,
            )
        )

    return items


@router.get(
    "/timeseries",
    response_model=TimeseriesResponse,
    summary="Windowed time series with server-chosen granularity",
)
async def get_metrics_timeseries(
    start_time: datetime = Query(..., description="Start of window"),
    end_time: datetime = Query(..., description="End of window"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> TimeseriesResponse:
    """Return time-bucketed series over the window (hourly, daily, or weekly)."""
    _validate_window(start_time, end_time)
    delta = end_time - start_time

    # Server-chosen granularity per spec 15
    if delta <= timedelta(days=2):
        granularity = "hourly"
        step = timedelta(hours=1)
    elif delta <= timedelta(days=90):
        granularity = "daily"
        step = timedelta(days=1)
    else:
        granularity = "weekly"
        step = timedelta(weeks=1)

    # Build bucket boundaries
    buckets_dict: dict[datetime, dict] = {}
    curr = start_time
    while curr < end_time:
        buckets_dict[curr] = {"created": 0, "resolved": 0, "missed": 0}
        curr += step

    stmt = select(Ticket).where(
        Ticket.created_at >= start_time,
        Ticket.created_at <= end_time,
    )
    res = await session.execute(stmt)
    tickets = res.scalars().all()

    bucket_keys = sorted(buckets_dict.keys())

    def _find_bucket(ts: datetime) -> Optional[datetime]:
        for i in range(len(bucket_keys) - 1, -1, -1):
            if ts >= bucket_keys[i]:
                return bucket_keys[i]
        return bucket_keys[0] if bucket_keys else None

    for t in tickets:
        b_key = _find_bucket(t.created_at)
        if b_key and b_key in buckets_dict:
            buckets_dict[b_key]["created"] += 1
            if t.resolved_at is not None:
                if t.resolved_at <= t.sla_deadline:
                    buckets_dict[b_key]["resolved"] += 1
                else:
                    buckets_dict[b_key]["missed"] += 1
            elif t.sla_breached:
                buckets_dict[b_key]["missed"] += 1

    bucket_list = [
        TimeseriesBucket(
            bucket_start=k,
            created_count=v["created"],
            resolved_count=v["resolved"],
            missed_count=v["missed"],
        )
        for k, v in sorted(buckets_dict.items())
    ]

    return TimeseriesResponse(
        window_start=start_time,
        window_end=end_time,
        granularity=granularity,
        buckets=bucket_list,
    )
