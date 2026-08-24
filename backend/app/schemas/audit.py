import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    action: str
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
