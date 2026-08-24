from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    AGENT = "agent"
    CUSTOMER = "customer"


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AuditAction(str, Enum):
    TICKET_CREATED = "ticket_created"
    STATUS_CHANGED = "status_changed"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    PRIORITY_OVERRIDDEN = "priority_overridden"
    SLA_BREACHED = "sla_breached"
    COMMENT_ADDED = "comment_added"
    ATTACHMENT_ADDED = "attachment_added"
