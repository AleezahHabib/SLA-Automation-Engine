import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    is_archived: Optional[bool] = None


class CustomerSummary(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class CustomerResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    is_archived: bool
    has_portal_access: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
