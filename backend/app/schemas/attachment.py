import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AttachmentResponse(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    uploaded_by_id: uuid.UUID
    uploaded_by_name: str
    original_filename: str
    storage_key: str
    content_type: str
    size_bytes: int
    is_customer_visible: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
