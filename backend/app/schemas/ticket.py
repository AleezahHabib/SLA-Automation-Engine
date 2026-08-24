import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Priority, TicketStatus
from app.schemas.customer import CustomerSummary


class AgentSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class StaffTicketCreate(BaseModel):
    customer_id: uuid.UUID
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)


class CustomerTicketCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class TicketAssignmentUpdate(BaseModel):
    assigned_agent_id: Optional[uuid.UUID] = None


class TicketPriorityOverride(BaseModel):
    priority: Priority


class TicketResponse(BaseModel):
    id: uuid.UUID
    reference: str
    subject: str
    description: str
    status: str
    priority: str
    customer: CustomerSummary
    assigned_agent: Optional[AgentSummary] = None
    created_at: datetime
    updated_at: datetime
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    sla_deadline: datetime
    sla_breached: bool
    sla_breached_at: Optional[datetime] = None
    available_transitions: List[str] = Field(default_factory=list)
    can_assign: bool = False
    can_override_priority: bool = False

    model_config = ConfigDict(from_attributes=True)


class TicketListItem(BaseModel):
    id: uuid.UUID
    reference: str
    subject: str
    status: str
    priority: str
    customer: CustomerSummary
    assigned_agent: Optional[AgentSummary] = None
    created_at: datetime
    updated_at: datetime
    sla_deadline: datetime
    sla_breached: bool

    model_config = ConfigDict(from_attributes=True)


class TicketSummaryCounts(BaseModel):
    by_status: Dict[str, int]
    by_priority: Optional[Dict[str, int]] = None
    unassigned: Optional[int] = None
    breached: Optional[int] = None
