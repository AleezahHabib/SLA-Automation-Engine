export enum Role {
  ADMIN = "admin",
  AGENT = "agent",
  CUSTOMER = "customer",
}

export enum TicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export enum Priority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export enum SlaPresentationState {
  ON_TRACK = "on_track",
  AT_RISK = "at_risk",
  BREACHED = "breached",
}

export enum AuditAction {
  TICKET_CREATED = "ticket_created",
  STATUS_CHANGED = "status_changed",
  ASSIGNED = "assigned",
  UNASSIGNED = "unassigned",
  PRIORITY_OVERRIDDEN = "priority_overridden",
  SLA_BREACHED = "sla_breached",
  COMMENT_ADDED = "comment_added",
  ATTACHMENT_ADDED = "attachment_added",
}
