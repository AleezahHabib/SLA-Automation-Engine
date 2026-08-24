import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    uploaded_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    original_filename = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    is_customer_visible = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    ticket = relationship("Ticket", back_populates="attachments")
    uploaded_by = relationship("User", back_populates="attachments")
    blob = relationship("AttachmentBlob", back_populates="attachment", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_attachments_ticket_id", ticket_id),
        Index("ix_attachments_ticket_id_is_customer_visible", ticket_id, is_customer_visible),
        Index("ix_attachments_storage_key", storage_key, unique=True),
    )


class AttachmentBlob(Base):
    __tablename__ = "attachment_blobs"

    storage_key = Column(
        String(255),
        ForeignKey("attachments.storage_key", ondelete="CASCADE"),
        primary_key=True,
    )
    data = Column(LargeBinary, nullable=False)

    attachment = relationship("Attachment", back_populates="blob")
