"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ticket reference sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq START WITH 1 INCREMENT BY 1;")

    # 2. Create customers table
    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_customers_email_lower", "customers", [sa.text("lower(email)")], unique=True)
    op.create_index("ix_customers_is_archived", "customers", ["is_archived"])
    op.create_index("ix_customers_name", "customers", ["name"])

    # 3. Create users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("role IN ('admin', 'agent', 'customer')", name="check_users_role_valid"),
        sa.CheckConstraint(
            "(role = 'customer' AND customer_id IS NOT NULL) OR (role IN ('admin', 'agent') AND customer_id IS NULL)",
            name="check_users_customer_role_binding",
        ),
    )
    op.create_index("ix_users_email_lower", "users", [sa.text("lower(email)")], unique=True)
    op.create_index(
        "ix_users_customer_id_unique",
        "users",
        ["customer_id"],
        unique=True,
        postgresql_where=sa.text("customer_id IS NOT NULL"),
    )

    # 4. Create tickets table
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reference", sa.String(50), nullable=False, unique=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(50), nullable=False),
        sa.Column("assigned_agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sla_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sla_breached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sla_breached_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('open', 'in_progress', 'resolved', 'closed')", name="check_tickets_status_valid"),
        sa.CheckConstraint("priority IN ('critical', 'high', 'medium', 'low')", name="check_tickets_priority_valid"),
    )
    op.create_index("ix_tickets_reference", "tickets", ["reference"], unique=True)
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_priority", "tickets", ["priority"])
    op.create_index("ix_tickets_assigned_agent_id", "tickets", ["assigned_agent_id"])
    op.create_index("ix_tickets_customer_id", "tickets", ["customer_id"])
    op.create_index("ix_tickets_customer_id_status", "tickets", ["customer_id", "status"])
    op.create_index("ix_tickets_sla_deadline", "tickets", ["sla_deadline"])
    op.create_index("ix_tickets_status_sla_deadline", "tickets", ["status", "sla_deadline"])
    op.create_index("ix_tickets_assigned_agent_id_status", "tickets", ["assigned_agent_id", "status"])
    op.create_index("ix_tickets_created_at", "tickets", ["created_at"])

    # 5. Create comments table
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("char_length(body) <= 4000 AND char_length(trim(body)) > 0", name="check_comments_body_length"),
    )
    op.create_index("ix_comments_ticket_id_is_internal", "comments", ["ticket_id", "is_internal"])
    op.create_index("ix_comments_ticket_id_created_at", "comments", ["ticket_id", "created_at"])

    # 6. Create attachments table
    op.create_table(
        "attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("is_customer_visible", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_attachments_ticket_id", "attachments", ["ticket_id"])
    op.create_index("ix_attachments_ticket_id_is_customer_visible", "attachments", ["ticket_id", "is_customer_visible"])
    op.create_index("ix_attachments_storage_key", "attachments", ["storage_key"], unique=True)

    # 7. Create attachment_blobs table
    op.create_table(
        "attachment_blobs",
        sa.Column("storage_key", sa.String(255), sa.ForeignKey("attachments.storage_key", ondelete="CASCADE"), primary_key=True),
        sa.Column("data", sa.LargeBinary(), nullable=False),
    )

    # 8. Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("from_value", sa.String(255), nullable=True),
        sa.Column("to_value", sa.String(255), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint(
            "action IN ('ticket_created', 'status_changed', 'assigned', 'unassigned', "
            "'priority_overridden', 'sla_breached', 'comment_added', 'attachment_added')",
            name="check_audit_logs_action_valid",
        ),
    )
    op.create_index("ix_audit_logs_ticket_id_created_at", "audit_logs", ["ticket_id", "created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("attachment_blobs")
    op.drop_table("attachments")
    op.drop_table("comments")
    op.drop_table("tickets")
    op.drop_table("users")
    op.drop_table("customers")
    op.execute("DROP SEQUENCE IF EXISTS ticket_reference_seq;")
