from datetime import datetime, timedelta, timezone
import re
from typing import Optional, Tuple
from app.models.enums import Priority
from app.models.ticket import Ticket

TRIAGE_RULE_VERSION = "triage_v1"

# SLA window durations in hours per priority level
SLA_WINDOWS: dict[Priority, timedelta] = {
    Priority.CRITICAL: timedelta(hours=2),
    Priority.HIGH: timedelta(hours=8),
    Priority.MEDIUM: timedelta(hours=24),
    Priority.LOW: timedelta(hours=72),
}

# Ordered triage keyword lists for regex word-boundary matching
CRITICAL_TERMS = [
    r"\boutage\b",
    r"\boutages\b",
    r"\bdown\b",
    r"\bcritical\b",
    r"\bemergency\b",
    r"\bproduction\b",
    r"\bcrash\b",
    r"\bcrashes\b",
    r"\bsecurity\b",
    r"\bbreach\b",
    r"\bdata\s+loss\b",
    r"\bsev-?1\b",
]

HIGH_TERMS = [
    r"\burgent\b",
    r"\bhigh\b",
    r"\bdegraded\b",
    r"\bfailure\b",
    r"\bfailures\b",
    r"\bbroken\b",
    r"\bmajor\b",
    r"\btimeout\b",
    r"\btimeouts\b",
    r"\bslowdown\b",
    r"\bsev-?2\b",
]

LOW_TERMS = [
    r"\bquestion\b",
    r"\bquestions\b",
    r"\binquiry\b",
    r"\binquiries\b",
    r"\binfo\b",
    r"\bminor\b",
    r"\bcosmetic\b",
    r"\btypo\b",
    r"\btypos\b",
    r"\bdocumentation\b",
    r"\bdocs\b",
    r"\bfeedback\b",
    r"\bfeature\s+request\b",
    r"\blow\b",
]

# Compile case-insensitive regex patterns
CRITICAL_REGEX = re.compile("|".join(CRITICAL_TERMS), re.IGNORECASE)
HIGH_REGEX = re.compile("|".join(HIGH_TERMS), re.IGNORECASE)
LOW_REGEX = re.compile("|".join(LOW_TERMS), re.IGNORECASE)


def triage_ticket(subject: str, description: str) -> Tuple[Priority, str]:
    """Deterministically triage subject and description into a Priority.
    
    Returns:
        Tuple of (Priority, rule_version)
    """
    text = f"{subject} {description}"

    if CRITICAL_REGEX.search(text):
        return Priority.CRITICAL, TRIAGE_RULE_VERSION
    if HIGH_REGEX.search(text):
        return Priority.HIGH, TRIAGE_RULE_VERSION
    if LOW_REGEX.search(text):
        return Priority.LOW, TRIAGE_RULE_VERSION

    return Priority.MEDIUM, TRIAGE_RULE_VERSION


def calculate_deadline(created_at: datetime, priority: Priority) -> datetime:
    """Calculate the SLA deadline from creation timestamp and priority window."""
    window = SLA_WINDOWS.get(priority, SLA_WINDOWS[Priority.MEDIUM])
    return created_at + window


def is_ticket_breached(ticket: Ticket, current_time: Optional[datetime] = None) -> bool:
    """Check if a ticket is breached per spec 06 definition.
    
    A ticket is breached if:
    1. It reached 'resolved' after its sla_deadline (resolved_at > sla_deadline)
    2. It is currently unresolved ('open' or 'in_progress') and current_time > sla_deadline
    """
    now = current_time or datetime.now(timezone.utc)

    if ticket.resolved_at is not None:
        return ticket.resolved_at > ticket.sla_deadline

    # Unresolved ticket check
    return now > ticket.sla_deadline


def calculate_compliance_rate(met: int, missed: int) -> Optional[float]:
    """Calculate SLA compliance rate (met / (met + missed)).
    
    Returns None if no tickets are evaluated (denominator is 0).
    """
    total = met + missed
    if total == 0:
        return None
    return round((met / total) * 100.0, 2)
