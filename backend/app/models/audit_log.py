import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    actor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    action = Column(String(50), nullable=False)
    from_value = Column(String(255), nullable=True)
    to_value = Column(String(255), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    ticket = relationship("Ticket", back_populates="audit_logs")
    actor = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        CheckConstraint(
            "action IN ('ticket_created', 'status_changed', 'assigned', 'unassigned', "
            "'priority_overridden', 'sla_breached', 'comment_added', 'attachment_added')",
            name="check_audit_logs_action_valid",
        ),
        Index("ix_audit_logs_ticket_id_created_at", ticket_id, created_at),
    )
