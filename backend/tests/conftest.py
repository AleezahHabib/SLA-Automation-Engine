import asyncio
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.customer import Customer
from app.models.enums import Role
from app.models.user import User

# Test SQLite async engine for isolated local testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database schema for each test function and yield a session."""
    # Ensure SLA worker is disabled in test per spec 13 R8 / 17 R5
    settings.SLA_WORKER_ENABLED = False

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an AsyncClient wired with the test database dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def test_data(db_session: AsyncSession):
    """Seed test fixtures: admin, agent, customer A, customer B, and an unlinked customer."""
    pwd_hash = get_password_hash("TestPassword123!")

    # 1. Admin
    admin = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        full_name="Admin Test",
        password_hash=pwd_hash,
        role=Role.ADMIN.value,
        customer_id=None,
        is_active=True,
    )
    db_session.add(admin)

    # 2. Agent
    agent = User(
        id=uuid.uuid4(),
        email="agent@test.com",
        full_name="Agent Test",
        password_hash=pwd_hash,
        role=Role.AGENT.value,
        customer_id=None,
        is_active=True,
    )
    db_session.add(agent)

    # 3. Customer A Record & User
    cust_a = Customer(
        id=uuid.uuid4(),
        name="Customer A Record",
        email="customera@test.com",
        company="Acme Co",
        is_archived=False,
    )
    db_session.add(cust_a)
    await db_session.flush()

    user_cust_a = User(
        id=uuid.uuid4(),
        email="customera@test.com",
        full_name="Alice Customer",
        password_hash=pwd_hash,
        role=Role.CUSTOMER.value,
        customer_id=cust_a.id,
        is_active=True,
    )
    db_session.add(user_cust_a)

    # 4. Customer B Record & User (For Tenant Isolation testing)
    cust_b = Customer(
        id=uuid.uuid4(),
        name="Customer B Record",
        email="customerb@test.com",
        company="Globex Co",
        is_archived=False,
    )
    db_session.add(cust_b)
    await db_session.flush()

    user_cust_b = User(
        id=uuid.uuid4(),
        email="customerb@test.com",
        full_name="Bob Customer",
        password_hash=pwd_hash,
        role=Role.CUSTOMER.value,
        customer_id=cust_b.id,
        is_active=True,
    )
    db_session.add(user_cust_b)

    # 5. Unlinked Customer (no login yet)
    cust_unlinked = Customer(
        id=uuid.uuid4(),
        name="Unlinked Customer",
        email="unlinked@test.com",
        company="Unlinked Co",
        is_archived=False,
    )
    db_session.add(cust_unlinked)

    await db_session.commit()

    return {
        "admin": admin,
        "agent": agent,
        "cust_a": cust_a,
        "user_cust_a": user_cust_a,
        "cust_b": cust_b,
        "user_cust_b": user_cust_b,
        "cust_unlinked": cust_unlinked,
        "tokens": {
            "admin": create_access_token(str(admin.id), admin.role, admin.email),
            "agent": create_access_token(str(agent.id), agent.role, agent.email),
            "cust_a": create_access_token(str(user_cust_a.id), user_cust_a.role, user_cust_a.email, str(cust_a.id)),
            "cust_b": create_access_token(str(user_cust_b.id), user_cust_b.role, user_cust_b.email, str(cust_b.id)),
        }
    }
