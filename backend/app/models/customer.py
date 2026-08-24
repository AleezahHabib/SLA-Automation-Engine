import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    company = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    linked_user = relationship("User", back_populates="customer", uselist=False, foreign_keys="User.customer_id")
    tickets = relationship("Ticket", back_populates="customer", cascade="all, delete-orphan", passive_deletes=False)

    @property
    def has_portal_access(self) -> bool:
        return self.linked_user is not None and self.linked_user.is_active

    __table_args__ = (
        Index("ix_customers_email_lower", func.lower(email), unique=True),
        Index("ix_customers_is_archived", is_archived),
        Index("ix_customers_name", name),
    )
