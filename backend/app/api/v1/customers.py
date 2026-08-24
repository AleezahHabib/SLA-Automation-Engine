import math
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.exceptions import NotFoundException, ValidationException
from app.models.customer import Customer
from app.models.enums import Role
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerSummary,
    CustomerUpdate,
)
from app.schemas.envelope import PaginationEnvelope

router = APIRouter(prefix="/api/v1/customers", tags=["Customers"])


def _customer_to_response(customer: Customer) -> CustomerResponse:
    has_portal = False
    if customer.linked_user is not None and customer.linked_user.is_active:
        has_portal = True
    return CustomerResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        company=customer.company,
        phone=customer.phone,
        is_archived=customer.is_archived,
        has_portal_access=has_portal,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
    )


@router.get(
    "/selectable",
    response_model=List[CustomerSummary],
    summary="Searchable customer list for intake selection",
)
async def get_selectable_customers(
    search: Optional[str] = Query(None, description="Search term for name or email"),
    limit: int = Query(50, ge=1, le=100, description="Max items returned"),
    current_user: User = Depends(require_role(Role.ADMIN, Role.AGENT)),
    session: AsyncSession = Depends(get_db),
) -> List[CustomerSummary]:
    """Lightweight selection endpoint for ticket intake (excludes archived records)."""
    stmt = select(Customer).where(Customer.is_archived.is_(False))

    if search:
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Customer.name).like(term),
                func.lower(Customer.email).like(term),
            )
        )

    stmt = stmt.order_by(Customer.name.asc(), Customer.id.asc()).limit(limit)
    result = await session.execute(stmt)
    customers = result.scalars().all()

    return [CustomerSummary(id=c.id, name=c.name, email=c.email) for c in customers]


@router.get(
    "",
    response_model=PaginationEnvelope[CustomerResponse],
    summary="List and search customers",
)
async def list_customers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Page size (max 100)"),
    search: Optional[str] = Query(None, description="Search term"),
    include_archived: bool = Query(False, description="Include archived customers"),
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> PaginationEnvelope[CustomerResponse]:
    """List customers with search, pagination, and archive filtering (admin only)."""
    # Clamp page size
    page_size = min(max(page_size, 1), 100)

    stmt = select(Customer).options(selectinload(Customer.linked_user))
    count_stmt = select(func.count()).select_from(Customer)

    if not include_archived:
        stmt = stmt.where(Customer.is_archived.is_(False))
        count_stmt = count_stmt.where(Customer.is_archived.is_(False))

    if search:
        term = f"%{search.strip().lower()}%"
        search_filter = or_(
            func.lower(Customer.name).like(term),
            func.lower(Customer.email).like(term),
            func.lower(Customer.company).like(term),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    # Stable ordering per spec 02 / 09
    stmt = stmt.order_by(Customer.created_at.desc(), Customer.id.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    total_res = await session.execute(count_stmt)
    total = total_res.scalar_one()

    result = await session.execute(stmt)
    items = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return PaginationEnvelope(
        items=[_customer_to_response(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a customer record",
)
async def create_customer(
    req: CustomerCreate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Create a new Customer record (admin only)."""
    email_clean = req.email.lower().strip()

    # Check for duplicate email
    existing = await session.execute(
        select(Customer).where(func.lower(Customer.email) == email_clean)
    )
    if existing.scalar_one_or_none():
        raise ValidationException(
            code="validation_error",
            message="A customer with this email address already exists",
            details=[{"field": "email", "message": "Email is already in use"}],
        )

    customer = Customer(
        name=req.name.strip(),
        email=email_clean,
        company=req.company.strip() if req.company else None,
        phone=req.phone.strip() if req.phone else None,
        is_archived=False,
    )
    session.add(customer)
    await session.commit()
    await session.refresh(customer)

    # Re-fetch with linked_user
    res = await session.execute(
        select(Customer).where(Customer.id == customer.id).options(selectinload(Customer.linked_user))
    )
    loaded = res.scalar_one()
    return _customer_to_response(loaded)


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Retrieve single customer profile",
)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Retrieve single customer detail (admin only)."""
    res = await session.execute(
        select(Customer).where(Customer.id == customer_id).options(selectinload(Customer.linked_user))
    )
    customer = res.scalar_one_or_none()
    if not customer:
        raise NotFoundException(code="not_found", message="Customer not found")

    return _customer_to_response(customer)


@router.patch(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update customer profile or archive status",
)
async def update_customer(
    customer_id: uuid.UUID,
    req: CustomerUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> CustomerResponse:
    """Partially update a customer record (admin only)."""
    res = await session.execute(
        select(Customer).where(Customer.id == customer_id).options(selectinload(Customer.linked_user))
    )
    customer = res.scalar_one_or_none()
    if not customer:
        raise NotFoundException(code="not_found", message="Customer not found")

    # If email changed, check uniqueness
    if req.email is not None:
        email_clean = req.email.lower().strip()
        if email_clean != customer.email.lower():
            dup = await session.execute(
                select(Customer).where(
                    func.lower(Customer.email) == email_clean,
                    Customer.id != customer_id,
                )
            )
            if dup.scalar_one_or_none():
                raise ValidationException(
                    code="validation_error",
                    message="A customer with this email address already exists",
                    details=[{"field": "email", "message": "Email is already in use"}],
                )
            customer.email = email_clean

    if req.name is not None:
        customer.name = req.name.strip()
    if req.company is not None:
        customer.company = req.company.strip() if req.company else None
    if req.phone is not None:
        customer.phone = req.phone.strip() if req.phone else None

    # Archiving logic: archiving also deactivates linked user per spec 08 R9
    if req.is_archived is not None:
        customer.is_archived = req.is_archived
        if customer.is_archived and customer.linked_user is not None:
            customer.linked_user.is_active = False

    await session.commit()
    await session.refresh(customer)
    return _customer_to_response(customer)
