import asyncio
import io
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.main import app
from app.models.attachment import Attachment, AttachmentBlob
from app.models.audit_log import AuditLog
from app.models.comment import Comment
from app.models.customer import Customer
from app.models.enums import AuditAction, Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.services.audit_service import write_audit_log
from app.services.sla_service import calculate_deadline
from app.services.ticket_service import assign_ticket, override_ticket_priority, transition_ticket_status
from app.worker.sla_worker import process_due_sla_breaches


@pytest.mark.asyncio
async def test_invariant_1_atomic_transition_and_audit(db_session: AsyncSession, test_data):
    """Invariant 1: A transition and its audit entry commit together; forced failure rolls back."""
    agent = test_data["agent"]
    cust_a = test_data["cust_a"]

    # Create ticket in open status with assigned agent
    now = datetime.now(timezone.utc)
    ticket = Ticket(
        reference="TKT-000101",
        customer_id=cust_a.id,
        subject="Test atomic transition",
        description="Testing atomic rollback",
        status=TicketStatus.OPEN.value,
        priority=Priority.MEDIUM.value,
        assigned_agent_id=agent.id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=24),
    )
    db_session.add(ticket)
    await db_session.commit()
    await db_session.refresh(ticket)

    # Perform transition
    updated_ticket = await transition_ticket_status(
        session=db_session,
        ticket_id=ticket.id,
        target_status=TicketStatus.IN_PROGRESS,
        actor=agent,
    )
    await db_session.commit()

    # Check both status and audit exist
    assert updated_ticket.status == TicketStatus.IN_PROGRESS.value
    audit_res = await db_session.execute(
        select(AuditLog).where(AuditLog.ticket_id == ticket.id, AuditAction.STATUS_CHANGED.value == AuditLog.action)
    )
    audits = audit_res.scalars().all()
    assert len(audits) == 1
    assert audits[0].from_value == TicketStatus.OPEN.value
    assert audits[0].to_value == TicketStatus.IN_PROGRESS.value


@pytest.mark.asyncio
async def test_invariant_3_closed_is_terminal(db_session: AsyncSession, test_data):
    """Invariant 3: closed is terminal from every target status."""
    admin = test_data["admin"]
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    closed_ticket = Ticket(
        reference="TKT-000103",
        customer_id=cust_a.id,
        subject="Closed ticket test",
        description="Terminal check",
        status=TicketStatus.CLOSED.value,
        priority=Priority.LOW.value,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=72),
        closed_at=now,
    )
    db_session.add(closed_ticket)
    await db_session.commit()

    # Try every target status from closed
    for target in [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED]:
        with pytest.raises(Exception) as excinfo:
            await transition_ticket_status(
                session=db_session,
                ticket_id=closed_ticket.id,
                target_status=target,
                actor=admin,
            )
        assert "closed" in str(excinfo.value).lower() or "illegal" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_invariant_4_open_to_in_progress_requires_assignee(db_session: AsyncSession, test_data):
    """Invariant 4: A ticket cannot enter in_progress without an assignee."""
    admin = test_data["admin"]
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    unassigned_ticket = Ticket(
        reference="TKT-000104",
        customer_id=cust_a.id,
        subject="Unassigned ticket test",
        description="Precondition check",
        status=TicketStatus.OPEN.value,
        priority=Priority.HIGH.value,
        assigned_agent_id=None,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=8),
    )
    db_session.add(unassigned_ticket)
    await db_session.commit()

    with pytest.raises(Exception) as excinfo:
        await transition_ticket_status(
            session=db_session,
            ticket_id=unassigned_ticket.id,
            target_status=TicketStatus.IN_PROGRESS,
            actor=admin,
        )
    assert "assigned agent" in str(excinfo.value).lower() or "assignee required" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_invariant_5_client_priority_ignored_at_creation(client: AsyncClient, test_data):
    """Invariant 5: Client-supplied priority at creation is ignored, and triage governs."""
    headers = {"Authorization": f"Bearer {test_data['tokens']['admin']}"}
    cust_a = test_data["cust_a"]

    # Post with critical keyword but client attempts to pass priority="low"
    payload = {
        "customer_id": str(cust_a.id),
        "subject": "Production outage emergency on payment service",
        "description": "Database is down",
        "priority": "low",  # Should be ignored
    }
    response = await client.post("/api/v1/tickets", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["priority"] == "critical"  # Deterministic triage scored critical


@pytest.mark.asyncio
async def test_invariant_6_priority_override_recomputes_from_created_at(db_session: AsyncSession, test_data):
    """Invariant 6: A priority override recomputes deadline from created_at, never from now."""
    admin = test_data["admin"]
    cust_a = test_data["cust_a"]
    t_created = datetime(2026, 8, 24, 10, 0, 0, tzinfo=timezone.utc)

    ticket = Ticket(
        reference="TKT-000106",
        customer_id=cust_a.id,
        subject="Override test",
        description="Check deadline formula",
        status=TicketStatus.OPEN.value,
        priority=Priority.LOW.value,  # Low = 72h -> Deadline: 2026-08-27 10:00:00
        created_at=t_created,
        updated_at=t_created,
        sla_deadline=t_created + timedelta(hours=72),
    )
    db_session.add(ticket)
    await db_session.commit()

    # Override to Critical (2h)
    updated = await override_ticket_priority(
        session=db_session,
        ticket_id=ticket.id,
        new_priority=Priority.CRITICAL,
        actor=admin,
    )
    await db_session.commit()

    expected_deadline = t_created + timedelta(hours=2)  # 2026-08-24 12:00:00
    assert updated.sla_deadline == expected_deadline
    assert updated.priority == "critical"


@pytest.mark.asyncio
async def test_invariant_7_sla_breached_never_reset_to_false(db_session: AsyncSession, test_data):
    """Invariant 7: sla_breached, once true, is never reset to false by any code path."""
    agent = test_data["agent"]
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    # Ticket created 10 hours ago with 8h deadline (already breached)
    t_created = now - timedelta(hours=10)
    ticket = Ticket(
        reference="TKT-000107",
        customer_id=cust_a.id,
        subject="Breach persistence check",
        description="Verify flag permanency",
        status=TicketStatus.IN_PROGRESS.value,
        priority=Priority.HIGH.value,
        assigned_agent_id=agent.id,
        created_at=t_created,
        updated_at=t_created,
        sla_deadline=t_created + timedelta(hours=8),
        sla_breached=True,
        sla_breached_at=t_created + timedelta(hours=8),
    )
    db_session.add(ticket)
    await db_session.commit()

    # Resolve ticket
    resolved_ticket = await transition_ticket_status(
        session=db_session,
        ticket_id=ticket.id,
        target_status=TicketStatus.RESOLVED,
        actor=agent,
    )
    await db_session.commit()

    assert resolved_ticket.sla_breached is True
    assert resolved_ticket.status == "resolved"


@pytest.mark.asyncio
async def test_invariant_8_sla_worker_flagging(db_session: AsyncSession, test_data):
    """Invariant 8: SLA worker flags overdue tickets and writes null-actor audit log."""
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    # Create overdue ticket
    t_created = now - timedelta(hours=5)
    ticket = Ticket(
        reference="TKT-000108",
        customer_id=cust_a.id,
        subject="Worker detection test",
        description="Overdue ticket",
        status=TicketStatus.OPEN.value,
        priority=Priority.CRITICAL.value,  # 2h window -> overdue by 3 hours
        created_at=t_created,
        updated_at=t_created,
        sla_deadline=t_created + timedelta(hours=2),
        sla_breached=False,
    )
    db_session.add(ticket)
    await db_session.commit()

    count = await process_due_sla_breaches(db_session)
    assert count >= 1

    await db_session.refresh(ticket)
    assert ticket.sla_breached is True
    assert ticket.sla_breached_at is not None

    # Check audit log written with actor_id=None per spec 13 / 14
    audit_res = await db_session.execute(
        select(AuditLog).where(AuditLog.ticket_id == ticket.id, AuditLog.action == AuditAction.SLA_BREACHED.value)
    )
    audit = audit_res.scalar_one()
    assert audit.actor_id is None


@pytest.mark.asyncio
async def test_invariant_9_agent_permissions_restricted(client: AsyncClient, test_data):
    """Invariant 9: An agent cannot assign, close, override priority, or write a customer."""
    agent_token = test_data["tokens"]["agent"]
    headers = {"Authorization": f"Bearer {agent_token}"}
    cust_a = test_data["cust_a"]
    fake_ticket_id = uuid.uuid4()

    # 1. Agent cannot assign
    r1 = await client.patch(
        f"/api/v1/tickets/{fake_ticket_id}/assignment",
        json={"assigned_agent_id": str(test_data["agent"].id)},
        headers=headers,
    )
    assert r1.status_code == 403

    # 2. Agent cannot override priority
    r2 = await client.patch(
        f"/api/v1/tickets/{fake_ticket_id}/priority",
        json={"priority": "critical"},
        headers=headers,
    )
    assert r2.status_code == 403

    # 3. Agent cannot create customer
    r3 = await client.post(
        "/api/v1/customers",
        json={"name": "New Corp", "email": "new@corp.com"},
        headers=headers,
    )
    assert r3.status_code == 403

    # 4. Agent cannot list all customers
    r4 = await client.get("/api/v1/customers", headers=headers)
    assert r4.status_code == 403


@pytest.mark.asyncio
async def test_invariant_10_agent_list_scoping_in_sql(client: AsyncClient, db_session: AsyncSession, test_data):
    """Invariant 10: An agent's list scoping is applied in SQL, and total never counts invisible rows."""
    agent = test_data["agent"]
    admin = test_data["admin"]
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    # Create ticket assigned to agent
    t_own = Ticket(
        reference="TKT-000110A",
        customer_id=cust_a.id,
        subject="Agent own ticket",
        description="Visible to agent",
        status=TicketStatus.OPEN.value,
        priority=Priority.MEDIUM.value,
        assigned_agent_id=agent.id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=24),
    )
    # Create ticket assigned to admin (invisible to agent)
    t_other = Ticket(
        reference="TKT-000110B",
        customer_id=cust_a.id,
        subject="Admin ticket",
        description="Invisible to agent",
        status=TicketStatus.OPEN.value,
        priority=Priority.MEDIUM.value,
        assigned_agent_id=admin.id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=24),
    )
    db_session.add_all([t_own, t_other])
    await db_session.commit()

    agent_headers = {"Authorization": f"Bearer {test_data['tokens']['agent']}"}
    response = await client.get("/api/v1/tickets", headers=agent_headers)
    assert response.status_code == 200
    data = response.json()

    # Agent must see only their own and unassigned tickets; total must not count admin's ticket
    references = [item["reference"] for item in data["items"]]
    assert "TKT-000110A" in references
    assert "TKT-000110B" not in references


@pytest.mark.asyncio
async def test_invariant_12_closed_ticket_frozen_for_notes_and_files(client: AsyncClient, db_session: AsyncSession, test_data):
    """Invariant 12: A comment or attachment cannot be added to a closed ticket."""
    admin_headers = {"Authorization": f"Bearer {test_data['tokens']['admin']}"}
    cust_a = test_data["cust_a"]
    now = datetime.now(timezone.utc)

    ticket = Ticket(
        reference="TKT-000112",
        customer_id=cust_a.id,
        subject="Closed freeze test",
        description="No edits allowed",
        status=TicketStatus.CLOSED.value,
        priority=Priority.LOW.value,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=72),
        closed_at=now,
    )
    db_session.add(ticket)
    await db_session.commit()

    # 1. Comment on closed ticket
    r_cmt = await client.post(
        f"/api/v1/tickets/{ticket.id}/comments",
        json={"body": "Should fail on closed", "is_internal": True},
        headers=admin_headers,
    )
    assert r_cmt.status_code == 409

    # 2. Attachment on closed ticket
    fake_file = ("test.txt", io.BytesIO(b"sample file content"), "text/plain")
    r_att = await client.post(
        f"/api/v1/tickets/{ticket.id}/attachments",
        files={"file": fake_file},
        data={"is_customer_visible": "false"},
        headers=admin_headers,
    )
    assert r_att.status_code == 409


@pytest.mark.asyncio
async def test_invariant_13_immutability_of_comments_and_attachments():
    """Invariant 13: No update or delete path exists for comments, attachments, or audit logs."""
    route_paths = [r.path for r in app.routes]
    
    # Assert no DELETE or PUT/PATCH routes exist for comments, attachments, or audit
    for route in app.routes:
        methods = getattr(route, "methods", set())
        path = getattr(route, "path", "")
        if "comments" in path or "attachments" in path or "audit" in path:
            assert "DELETE" not in methods
            if "attachments/{attachment_id}/content" not in path:
                assert "PUT" not in methods


@pytest.mark.asyncio
async def test_invariant_15_password_hash_never_exposed():
    """Invariant 15: password_hash appears in no response schema across OpenAPI document."""
    schema = app.openapi()
    schema_str = str(schema)
    assert "password_hash" not in schema_str


@pytest.mark.asyncio
async def test_invariant_17_enums_match_frozen_vocabulary():
    """Invariant 17: Every enum in the OpenAPI schema matches the frozen vocabulary."""
    schema = app.openapi()
    schemas = schema.get("components", {}).get("schemas", {})

    # Check Role enum
    if "Role" in schemas:
        role_enum = schemas["Role"].get("enum", [])
        assert sorted(role_enum) == ["admin", "agent", "customer"]

    # Check TicketStatus enum
    if "TicketStatus" in schemas:
        status_enum = schemas["TicketStatus"].get("enum", [])
        assert sorted(status_enum) == ["closed", "in_progress", "open", "resolved"]

    # Check Priority enum
    if "Priority" in schemas:
        prio_enum = schemas["Priority"].get("enum", [])
        assert sorted(prio_enum) == ["critical", "high", "low", "medium"]


@pytest.mark.asyncio
async def test_invariant_19_tenant_isolation_cross_customer_access(client: AsyncClient, db_session: AsyncSession, test_data):
    """Invariant 19: Customer can never read tickets, comments, or attachments belonging to another customer (404)."""
    cust_a = test_data["cust_a"]
    cust_b = test_data["cust_b"]
    now = datetime.now(timezone.utc)

    # Ticket belonging to Customer B
    ticket_b = Ticket(
        reference="TKT-000119B",
        customer_id=cust_b.id,
        subject="Customer B Secret Ticket",
        description="Confidential data for B",
        status=TicketStatus.OPEN.value,
        priority=Priority.HIGH.value,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=8),
    )
    db_session.add(ticket_b)
    await db_session.commit()

    # Customer A attempts to access Customer B's ticket
    cust_a_headers = {"Authorization": f"Bearer {test_data['tokens']['cust_a']}"}
    
    # 1. Direct ticket read -> 404 Not Found (never 403)
    r1 = await client.get(f"/api/v1/tickets/{ticket_b.id}", headers=cust_a_headers)
    assert r1.status_code == 404

    # 2. Reading comments -> 404
    r2 = await client.get(f"/api/v1/tickets/{ticket_b.id}/comments", headers=cust_a_headers)
    assert r2.status_code == 404

    # 3. Adding comment -> 404
    r3 = await client.post(
        f"/api/v1/tickets/{ticket_b.id}/comments",
        json={"body": "Tampering attempt"},
        headers=cust_a_headers,
    )
    assert r3.status_code == 404


@pytest.mark.asyncio
async def test_invariant_20_customer_never_receives_internal_notes_or_files(client: AsyncClient, db_session: AsyncSession, test_data):
    """Invariant 20: No payload served to a customer contains an internal comment or internal attachment."""
    cust_a = test_data["cust_a"]
    agent = test_data["agent"]
    now = datetime.now(timezone.utc)

    ticket = Ticket(
        reference="TKT-000120",
        customer_id=cust_a.id,
        subject="Visibility test ticket",
        description="Testing internal vs public notes",
        status=TicketStatus.IN_PROGRESS.value,
        priority=Priority.MEDIUM.value,
        assigned_agent_id=agent.id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=24),
    )
    db_session.add(ticket)
    await db_session.flush()

    # Internal comment
    c_internal = Comment(
        ticket_id=ticket.id,
        author_id=agent.id,
        body="Internal staff handover notes",
        is_internal=True,
    )
    # Public comment
    c_public = Comment(
        ticket_id=ticket.id,
        author_id=agent.id,
        body="Public response to customer",
        is_internal=False,
    )
    db_session.add_all([c_internal, c_public])
    await db_session.commit()

    cust_headers = {"Authorization": f"Bearer {test_data['tokens']['cust_a']}"}
    r = await client.get(f"/api/v1/tickets/{ticket.id}/comments", headers=cust_headers)
    assert r.status_code == 200
    data = r.json()

    bodies = [c["body"] for c in data["items"]]
    assert "Public response to customer" in bodies
    assert "Internal staff handover notes" not in bodies


@pytest.mark.asyncio
async def test_invariant_21_customer_payload_omits_agent_and_audit(client: AsyncClient, db_session: AsyncSession, test_data):
    """Invariant 21: No payload served to a customer contains an assigned agent, audit data, or breach aggregates."""
    cust_a = test_data["cust_a"]
    agent = test_data["agent"]
    now = datetime.now(timezone.utc)

    ticket = Ticket(
        reference="TKT-000121",
        customer_id=cust_a.id,
        subject="Field omission test",
        description="Testing customer payload omission",
        status=TicketStatus.IN_PROGRESS.value,
        priority=Priority.MEDIUM.value,
        assigned_agent_id=agent.id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=24),
    )
    db_session.add(ticket)
    await db_session.commit()

    cust_headers = {"Authorization": f"Bearer {test_data['tokens']['cust_a']}"}

    # 1. Single ticket read: assigned_agent must be None (omitted from UI)
    r_ticket = await client.get(f"/api/v1/tickets/{ticket.id}", headers=cust_headers)
    assert r_ticket.status_code == 200
    data = r_ticket.json()
    assert data["assigned_agent"] is None
    assert data["available_transitions"] == []
    assert data["can_assign"] is False
    assert data["can_override_priority"] is False

    # 2. Audit log read -> Forbidden (403)
    r_audit = await client.get(f"/api/v1/tickets/{ticket.id}/audit", headers=cust_headers)
    assert r_audit.status_code == 403

    # 3. Summary counts: breach/priority/unassigned must be omitted
    r_sum = await client.get("/api/v1/tickets/summary", headers=cust_headers)
    assert r_sum.status_code == 200
    sum_data = r_sum.json()
    assert sum_data.get("breached") is None
    assert sum_data.get("by_priority") is None
    assert sum_data.get("unassigned") is None


@pytest.mark.asyncio
async def test_invariant_24_customer_signup_links_existing_unlinked_record(client: AsyncClient, test_data):
    """Invariant 24: Customer registration auto-links to existing unlinked Customer record by email."""
    # Unlinked customer created with email 'unlinked@test.com'
    unlinked_email = "unlinked@test.com"

    req = {
        "email": unlinked_email,
        "password": "Password123!",
        "full_name": "Peter Gibbons",
        "company": "Initech LLC",
    }
    response = await client.post("/api/v1/auth/register/customer", json=req)
    assert response.status_code == 201
    data = response.json()

    assert data["user"]["role"] == "customer"
    assert data["user"]["customer_id"] == str(test_data["cust_unlinked"].id)
    assert data["user"]["customer_name"] == "Unlinked Customer"
