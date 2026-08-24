import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
    is_internal: bool = True


class CommentResponse(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    author_role: str
    body: str
    is_internal: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
