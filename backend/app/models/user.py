import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=True,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    customer = relationship("Customer", back_populates="linked_user", foreign_keys=[customer_id])
    assigned_tickets = relationship("Ticket", back_populates="assigned_agent", foreign_keys="Ticket.assigned_agent_id")
    comments = relationship("Comment", back_populates="author")
    attachments = relationship("Attachment", back_populates="uploaded_by")
    audit_logs = relationship("AuditLog", back_populates="actor")

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'agent', 'customer')",
            name="check_users_role_valid",
        ),
        CheckConstraint(
            "(role = 'customer' AND customer_id IS NOT NULL) OR (role IN ('admin', 'agent') AND customer_id IS NULL)",
            name="check_users_customer_role_binding",
        ),
        Index("ix_users_email_lower", func.lower(email), unique=True),
        Index(
            "ix_users_customer_id_unique",
            customer_id,
            unique=True,
            postgresql_where=text("customer_id IS NOT NULL"),
            sqlite_where=text("customer_id IS NOT NULL"),
        ),
    )
