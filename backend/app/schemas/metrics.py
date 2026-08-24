import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class AgentWorkload(BaseModel):
    agent_id: uuid.UUID
    agent_name: str
    assigned_total: int
    by_status: Dict[str, int]
    breached_count: int

    model_config = ConfigDict(from_attributes=True)


class MetricsSummary(BaseModel):
    window_start: datetime
    window_end: datetime
    created_count: int
    resolved_count: int
    closed_count: int
    met_count: int
    missed_count: int
    compliance_rate: Optional[float] = None
    median_time_to_resolution_minutes: Optional[float] = None
    p90_time_to_resolution_minutes: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class MetricsByPriorityItem(BaseModel):
    priority: str
    created_count: int
    resolved_count: int
    met_count: int
    missed_count: int
    compliance_rate: Optional[float] = None
    median_time_to_resolution_minutes: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class MetricsByAgentItem(BaseModel):
    agent_id: uuid.UUID
    agent_name: str
    resolved_count: int
    met_count: int
    missed_count: int
    compliance_rate: Optional[float] = None
    median_time_to_resolution_minutes: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class TimeseriesBucket(BaseModel):
    bucket_start: datetime
    created_count: int
    resolved_count: int
    missed_count: int

    model_config = ConfigDict(from_attributes=True)


class TimeseriesResponse(BaseModel):
    window_start: datetime
    window_end: datetime
    granularity: str
    buckets: List[TimeseriesBucket]

    model_config = ConfigDict(from_attributes=True)
