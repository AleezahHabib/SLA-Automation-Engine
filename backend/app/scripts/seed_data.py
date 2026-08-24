import asyncio
import os
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.attachment import Attachment, AttachmentBlob
from app.models.comment import Comment
from app.models.customer import Customer
from app.models.enums import AuditAction, Priority, Role, TicketStatus
from app.models.ticket import Ticket
from app.models.user import User
from app.services.audit_service import write_audit_log
from app.services.sla_service import calculate_deadline, triage_ticket
from app.services.ticket_service import generate_ticket_reference

DEFAULT_PASSWORD = "Password123!"


async def seed_database() -> None:
    """Populate demonstration dataset spanning all roles, statuses, priorities, and SLA states."""
    print("Starting database seeding...")

    async with AsyncSessionLocal() as session:
        # Check if already seeded
        admin_check = await session.execute(select(User).where(User.email == "admin@example.com"))
        if admin_check.scalar_one_or_none():
            print("Database is already seeded with admin account. Skipping seed.")
            return

        now = datetime.now(timezone.utc)
        pwd_hash = get_password_hash(DEFAULT_PASSWORD)

        # 1. Create Staff Users
        admin_user = User(
            id=uuid.uuid4(),
            email="admin@example.com",
            full_name="System Admin",
            password_hash=pwd_hash,
            role=Role.ADMIN.value,
            customer_id=None,
            is_active=True,
            created_at=now - timedelta(days=30),
        )
        session.add(admin_user)

        agent_sarah = User(
            id=uuid.uuid4(),
            email="agent.sarah@example.com",
            full_name="Sarah Connor",
            password_hash=pwd_hash,
            role=Role.AGENT.value,
            customer_id=None,
            is_active=True,
            created_at=now - timedelta(days=30),
        )
        agent_john = User(
            id=uuid.uuid4(),
            email="agent.john@example.com",
            full_name="John Doe",
            password_hash=pwd_hash,
            role=Role.AGENT.value,
            customer_id=None,
            is_active=True,
            created_at=now - timedelta(days=30),
        )
        agent_jane = User(
            id=uuid.uuid4(),
            email="agent.jane@example.com",
            full_name="Jane Smith",
            password_hash=pwd_hash,
            role=Role.AGENT.value,
            customer_id=None,
            is_active=True,
            created_at=now - timedelta(days=30),
        )
        session.add_all([agent_sarah, agent_john, agent_jane])
        await session.flush()

        # 2. Create Customer Records
        cust_acme = Customer(
            id=uuid.uuid4(),
            name="Alice Johnson",
            email="customer.alice@acme.com",
            company="Acme Corporation",
            phone="+1-555-0101",
            is_archived=False,
            created_at=now - timedelta(days=20),
        )
        cust_globex = Customer(
            id=uuid.uuid4(),
            name="Bob Vance",
            email="customer.bob@globex.com",
            company="Globex Corporation",
            phone="+1-555-0102",
            is_archived=False,
            created_at=now - timedelta(days=20),
        )
        cust_initech = Customer(
            id=uuid.uuid4(),
            name="Peter Gibbons",
            email="contact@initech.com",
            company="Initech LLC",
            phone="+1-555-0103",
            is_archived=False,
            created_at=now - timedelta(days=15),
        )
        session.add_all([cust_acme, cust_globex, cust_initech])
        await session.flush()

        # 3. Create Linked Customer Users
        user_alice = User(
            id=uuid.uuid4(),
            email="customer.alice@acme.com",
            full_name="Alice Johnson",
            password_hash=pwd_hash,
            role=Role.CUSTOMER.value,
            customer_id=cust_acme.id,
            is_active=True,
            created_at=now - timedelta(days=20),
        )
        user_bob = User(
            id=uuid.uuid4(),
            email="customer.bob@globex.com",
            full_name="Bob Vance",
            password_hash=pwd_hash,
            role=Role.CUSTOMER.value,
            customer_id=cust_globex.id,
            is_active=True,
            created_at=now - timedelta(days=20),
        )
        session.add_all([user_alice, user_bob])
        await session.flush()

        # Helper function to create a ticket through domain logic
        async def create_seeded_ticket(
            customer: Customer,
            subject: str,
            description: str,
            created_offset: timedelta,
            assigned_agent: Optional[User] = None,
            status_val: TicketStatus = TicketStatus.OPEN,
            resolved_offset: Optional[timedelta] = None,
            closed_offset: Optional[timedelta] = None,
            is_breached: bool = False,
            override_priority: Optional[Priority] = None,
        ) -> Ticket:
            t_created = now - created_offset
            prio, triage_ver = triage_ticket(subject, description)
            if override_priority:
                prio = override_priority

            deadline = calculate_deadline(t_created, prio)

            first_resp = None
            if status_val in [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED]:
                first_resp = t_created + timedelta(minutes=15)

            t_resolved = None
            if status_val in [TicketStatus.RESOLVED, TicketStatus.CLOSED] and resolved_offset is not None:
                t_resolved = now - resolved_offset

            t_closed = None
            if status_val == TicketStatus.CLOSED and closed_offset is not None:
                t_closed = now - closed_offset

            ref = await generate_ticket_reference(session)

            ticket = Ticket(
                id=uuid.uuid4(),
                reference=ref,
                customer_id=customer.id,
                subject=subject,
                description=description,
                status=status_val.value,
                priority=prio.value,
                assigned_agent_id=assigned_agent.id if assigned_agent else None,
                created_at=t_created,
                updated_at=t_resolved or first_resp or t_created,
                first_response_at=first_resp,
                resolved_at=t_resolved,
                closed_at=t_closed,
                sla_deadline=deadline,
                sla_breached=is_breached,
                sla_breached_at=deadline if is_breached else None,
            )
            session.add(ticket)
            await session.flush()

            # Audit entry for creation
            await write_audit_log(
                session=session,
                ticket_id=ticket.id,
                action=AuditAction.TICKET_CREATED,
                from_value=None,
                to_value=TicketStatus.OPEN.value,
                detail=f"Triage rule version: {triage_ver}, Priority: {prio.value}, Deadline: {deadline.isoformat()}",
                actor_id=admin_user.id,
            )

            # Audit entry for assignment
            if assigned_agent:
                await write_audit_log(
                    session=session,
                    ticket_id=ticket.id,
                    action=AuditAction.ASSIGNED,
                    from_value=None,
                    to_value=assigned_agent.full_name,
                    detail=None,
                    actor_id=admin_user.id,
                )

            # Audit entry for status progression
            if status_val in [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED]:
                await write_audit_log(
                    session=session,
                    ticket_id=ticket.id,
                    action=AuditAction.STATUS_CHANGED,
                    from_value=TicketStatus.OPEN.value,
                    to_value=TicketStatus.IN_PROGRESS.value,
                    detail=None,
                    actor_id=assigned_agent.id if assigned_agent else admin_user.id,
                )

            if status_val in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
                await write_audit_log(
                    session=session,
                    ticket_id=ticket.id,
                    action=AuditAction.STATUS_CHANGED,
                    from_value=TicketStatus.IN_PROGRESS.value,
                    to_value=TicketStatus.RESOLVED.value,
                    detail=None,
                    actor_id=assigned_agent.id if assigned_agent else admin_user.id,
                )

            if status_val == TicketStatus.CLOSED:
                outcome = "Breached" if is_breached else "Met"
                await write_audit_log(
                    session=session,
                    ticket_id=ticket.id,
                    action=AuditAction.STATUS_CHANGED,
                    from_value=TicketStatus.RESOLVED.value,
                    to_value=TicketStatus.CLOSED.value,
                    detail=f"Ticket closed administratively. Final SLA outcome: {outcome}. Deadline: {deadline.isoformat()}, Resolved: {t_resolved.isoformat() if t_resolved else 'N/A'}",
                    actor_id=admin_user.id,
                )

            return ticket

        # 4. Seed Tickets for Acme Corp (Customer A)
        t1 = await create_seeded_ticket(
            customer=cust_acme,
            subject="Critical production outage on API cluster",
            description="Our payment gateway is down and throwing 500 errors across all production nodes.",
            created_offset=timedelta(hours=3),
            assigned_agent=agent_sarah,
            status_val=TicketStatus.IN_PROGRESS,
            is_breached=True,  # Critical window is 2h, created 3h ago -> Breached
        )

        t2 = await create_seeded_ticket(
            customer=cust_acme,
            subject="Urgent timeout on checkout flow",
            description="Users experiencing major slowdowns during checkout cart submission.",
            created_offset=timedelta(hours=6),
            assigned_agent=agent_sarah,
            status_val=TicketStatus.IN_PROGRESS,
            is_breached=False,  # High window is 8h, 2h remaining -> At Risk (<25%)
        )

        t3 = await create_seeded_ticket(
            customer=cust_acme,
            subject="Documentation typo in webhooks guide",
            description="Found a small cosmetic typo in the authentication header documentation section.",
            created_offset=timedelta(days=2),
            assigned_agent=agent_john,
            status_val=TicketStatus.RESOLVED,
            resolved_offset=timedelta(days=1),
            is_breached=False,  # Low window is 72h, resolved within 24h -> Met
        )

        t4 = await create_seeded_ticket(
            customer=cust_acme,
            subject="Question regarding invoice calculation",
            description="Need clarification on the tax line item for our latest monthly statement.",
            created_offset=timedelta(days=5),
            assigned_agent=agent_jane,
            status_val=TicketStatus.CLOSED,
            resolved_offset=timedelta(days=4),
            closed_offset=timedelta(days=3),
            is_breached=False,
        )

        # 5. Seed Tickets for Globex Inc (Customer B - Tenant Isolation verification)
        t5 = await create_seeded_ticket(
            customer=cust_globex,
            subject="Database performance failure during nightly backup",
            description="Nightly snapshot job caused broken connections and high CPU utilization.",
            created_offset=timedelta(hours=10),
            assigned_agent=agent_john,
            status_val=TicketStatus.OPEN,
            is_breached=True,  # High window is 8h, 10h old -> Breached
        )

        t6 = await create_seeded_ticket(
            customer=cust_globex,
            subject="Feature request for custom webhooks",
            description="Would like to request support for Slack webhook notifications on data export.",
            created_offset=timedelta(hours=12),
            assigned_agent=None,  # Unassigned pool
            status_val=TicketStatus.OPEN,
            is_breached=False,
        )

        t7 = await create_seeded_ticket(
            customer=cust_globex,
            subject="Security inquiry on SSO integration",
            description="Critical security review question about SAML token expiration settings.",
            created_offset=timedelta(days=3),
            assigned_agent=agent_sarah,
            status_val=TicketStatus.RESOLVED,
            resolved_offset=timedelta(days=2, hours=22),  # Resolved in 2 hours -> Met Critical SLA
            is_breached=False,
        )

        # 6. Seed Internal & Public Comments
        # Internal comment (Staff only)
        c1 = Comment(
            ticket_id=t1.id,
            author_id=agent_sarah.id,
            body="Investigated ingress logs: memory pressure on pod api-prod-03 caused crash loop. Rolling back hotfix.",
            is_internal=True,
            created_at=now - timedelta(hours=2, minutes=30),
        )
        # Public comment (Visible to customer)
        c2 = Comment(
            ticket_id=t1.id,
            author_id=agent_sarah.id,
            body="We have identified the issue on the cluster and are currently rolling out a patch to restore payment processing.",
            is_internal=False,
            created_at=now - timedelta(hours=2, minutes=15),
        )
        # Customer public response
        c3 = Comment(
            ticket_id=t1.id,
            author_id=user_alice.id,
            body="Thank you for the quick update. Our store transactions are beginning to recover.",
            is_internal=False,
            created_at=now - timedelta(hours=1, minutes=45),
        )
        session.add_all([c1, c2, c3])

        # 7. Seed Attachments (Transactional with blobs)
        storage_key_1 = f"att_{uuid.uuid4().hex}"
        sample_log_bytes = b"2026-08-24 08:12:00 [ERROR] OutOfMemoryError: Java heap space on worker node-4\n2026-08-24 08:12:05 [FATAL] Node terminated unexpectedly"
        
        att_internal = Attachment(
            ticket_id=t1.id,
            uploaded_by_id=agent_sarah.id,
            original_filename="cluster_crash_dump.log",
            storage_key=storage_key_1,
            content_type="text/plain",
            size_bytes=len(sample_log_bytes),
            is_customer_visible=False,
            created_at=now - timedelta(hours=2, minutes=20),
        )
        blob_internal = AttachmentBlob(
            storage_key=storage_key_1,
            data=sample_log_bytes,
        )
        session.add_all([att_internal, blob_internal])

        storage_key_2 = f"att_{uuid.uuid4().hex}"
        sample_screenshot_bytes = b"%PDF-1.4 sample error diagnostic report document"
        
        att_public = Attachment(
            ticket_id=t1.id,
            uploaded_by_id=user_alice.id,
            original_filename="checkout_error_screenshot.pdf",
            storage_key=storage_key_2,
            content_type="application/pdf",
            size_bytes=len(sample_screenshot_bytes),
            is_customer_visible=True,
            created_at=now - timedelta(hours=2, minutes=50),
        )
        blob_public = AttachmentBlob(
            storage_key=storage_key_2,
            data=sample_screenshot_bytes,
        )
        session.add_all([att_public, blob_public])

        await session.commit()
        print("Database successfully seeded with realistic multi-role demonstration dataset!")


if __name__ == "__main__":
    asyncio.run(seed_database())
