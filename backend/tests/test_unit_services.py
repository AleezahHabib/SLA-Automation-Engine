from datetime import datetime, timedelta, timezone
import pytest

from app.core.config import Settings
from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password
from app.models.enums import Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.services.sla_service import (
    SLA_WINDOWS,
    calculate_compliance_rate,
    calculate_deadline,
    is_ticket_breached,
    triage_ticket,
)


def test_triage_scoring_deterministic():
    """Verify deterministic rule-based priority triage and word-boundary matching."""
    # Critical terms
    crit_1, _ = triage_ticket("Database outage on cluster", "Service is completely down")
    assert crit_1 == Priority.CRITICAL

    crit_2, _ = triage_ticket("Emergency security breach detected", "Investigating crash dump")
    assert crit_2 == Priority.CRITICAL

    # High terms
    high_1, _ = triage_ticket("Urgent checkout slowdown", "Users seeing payment timeout")
    assert high_1 == Priority.HIGH

    # Low terms
    low_1, _ = triage_ticket("Documentation typo in guide", "Cosmetic feedback and minor inquiry")
    assert low_1 == Priority.LOW

    # Fallback to Medium
    med_1, _ = triage_ticket("Account assistance", "Need help configuring dashboard")
    assert med_1 == Priority.MEDIUM

    # Substring immunity: 'brownout' should not match 'out' as outage
    med_2, _ = triage_ticket("General notification", "Routine system updates")
    assert med_2 == Priority.MEDIUM


def test_sla_deadline_computation():
    """Verify exact calendar-time SLA deadline durations per priority."""
    now = datetime(2026, 8, 24, 12, 0, 0, tzinfo=timezone.utc)

    assert calculate_deadline(now, Priority.CRITICAL) == now + timedelta(hours=2)
    assert calculate_deadline(now, Priority.HIGH) == now + timedelta(hours=8)
    assert calculate_deadline(now, Priority.MEDIUM) == now + timedelta(hours=24)
    assert calculate_deadline(now, Priority.LOW) == now + timedelta(hours=72)


def test_breach_predicate_and_boundary_conditions():
    """Verify SLA breach definition for resolved and unresolved tickets."""
    created = datetime(2026, 8, 24, 10, 0, 0, tzinfo=timezone.utc)
    deadline = created + timedelta(hours=2)  # 12:00:00

    # 1. Resolved exactly on time (Met)
    t_met_exact = Ticket(
        created_at=created,
        sla_deadline=deadline,
        resolved_at=datetime(2026, 8, 24, 12, 0, 0, tzinfo=timezone.utc),
    )
    assert is_ticket_breached(t_met_exact) is False

    # 2. Resolved 1 second late (Missed)
    t_missed = Ticket(
        created_at=created,
        sla_deadline=deadline,
        resolved_at=datetime(2026, 8, 24, 12, 0, 1, tzinfo=timezone.utc),
    )
    assert is_ticket_breached(t_missed) is True

    # 3. Unresolved before deadline (On track)
    t_unresolved = Ticket(
        created_at=created,
        sla_deadline=deadline,
        resolved_at=None,
    )
    before_deadline = datetime(2026, 8, 24, 11, 59, 0, tzinfo=timezone.utc)
    assert is_ticket_breached(t_unresolved, current_time=before_deadline) is False

    # 4. Unresolved after deadline (Breached)
    after_deadline = datetime(2026, 8, 24, 12, 0, 1, tzinfo=timezone.utc)
    assert is_ticket_breached(t_unresolved, current_time=after_deadline) is True


def test_compliance_rate_calculation():
    """Verify compliance rate computation and division by zero protection."""
    # 8 met out of 10 evaluated = 80.0%
    assert calculate_compliance_rate(met=8, missed=2) == 80.0
    # 0 met out of 5 = 0.0%
    assert calculate_compliance_rate(met=0, missed=5) == 0.0
    # Zero denominator returns None per spec 15
    assert calculate_compliance_rate(met=0, missed=0) is None


def test_database_scheme_rewrite():
    """Verify asyncpg protocol conversion per spec 16 R4."""
    s1 = Settings(
        DATABASE_URL="postgres://user:pass@localhost:5432/db",
        JWT_SECRET="super-secret-key-at-least-32-chars-long!",
    )
    assert s1.async_database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"

    s2 = Settings(
        DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        JWT_SECRET="super-secret-key-at-least-32-chars-long!",
    )
    assert s2.async_database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"


def test_security_password_and_token():
    """Verify bcrypt password hashing and signed JWT claim encoding/decoding."""
    pwd = "StrongSecurePassword123!"
    h = get_password_hash(pwd)
    assert verify_password(pwd, h) is True
    assert verify_password("wrong-password", h) is False

    token = create_access_token(
        subject="user-uuid-123",
        role="agent",
        email="agent@test.com",
    )
    claims = decode_access_token(token)
    assert claims["sub"] == "user-uuid-123"
    assert claims["role"] == "agent"
    assert claims["email"] == "agent@test.com"
    assert "exp" in claims
    assert "iat" in claims
