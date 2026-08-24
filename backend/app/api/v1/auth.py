import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.customer import Customer
from app.models.enums import Role
from app.models.user import User
from app.schemas.auth import (
    CustomerRegisterRequest,
    LoginRequest,
    StaffRegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

# Dummy hash for constant-time comparison on unknown email per spec 07
DUMMY_HASH = "$2b$12$e8k8K3Z5LzQp0e8K8K3Z5.O123456789012345678901234567890"


def _format_user_response(user: User) -> UserResponse:
    customer_id = None
    customer_name = None
    if user.role == Role.CUSTOMER.value and user.customer:
        customer_id = user.customer.id
        customer_name = user.customer.name

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        customer_id=customer_id,
        customer_name=customer_name,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a staff user (Agent)",
)
async def register_staff(
    req: StaffRegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a staff user with role 'agent' and return a signed JWT token."""
    email_clean = req.email.lower().strip()

    # Check if user already exists
    existing = await session.execute(
        select(User).where(func.lower(User.email) == email_clean)
    )
    if existing.scalar_one_or_none():
        raise ValidationException(
            code="validation_error",
            message="An account with this email address already exists",
            details=[{"field": "email", "message": "Email is already registered"}],
        )

    user = User(
        email=email_clean,
        full_name=req.full_name.strip(),
        password_hash=get_password_hash(req.password),
        role=Role.AGENT.value,
        customer_id=None,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        email=user.email,
        customer_id=None,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_format_user_response(user),
    )


@router.post(
    "/register/customer",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a customer user and link/create its record",
)
async def register_customer(
    req: CustomerRegisterRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a customer user and its linked Customer record in one atomic transaction."""
    email_clean = req.email.lower().strip()

    # Check if a user account already exists with this email
    existing_user = await session.execute(
        select(User).where(func.lower(User.email) == email_clean)
    )
    if existing_user.scalar_one_or_none():
        raise ValidationException(
            code="validation_error",
            message="An account with this email address already exists",
            details=[{"field": "email", "message": "Email is already registered"}],
        )

    # Check if an existing Customer record exists with this email
    existing_cust_res = await session.execute(
        select(Customer)
        .where(func.lower(Customer.email) == email_clean)
        .options(selectinload(Customer.linked_user))
    )
    customer = existing_cust_res.scalar_one_or_none()

    if customer is not None:
        if customer.linked_user is not None:
            raise ValidationException(
                code="validation_error",
                message="This customer record already has an active login account",
                details=[{"field": "email", "message": "Customer record already has a login"}],
            )
        # Update company if supplied
        if req.company:
            customer.company = req.company.strip()
    else:
        # Create a new Customer record
        customer = Customer(
            name=req.full_name.strip(),
            email=email_clean,
            company=req.company.strip() if req.company else None,
            phone=None,
            is_archived=False,
        )
        session.add(customer)
        await session.flush()

    # Create the customer User record
    user = User(
        email=email_clean,
        full_name=req.full_name.strip(),
        password_hash=get_password_hash(req.password),
        role=Role.CUSTOMER.value,
        customer_id=customer.id,
        is_active=True,
    )
    session.add(user)
    await session.commit()

    # Re-fetch user with customer loaded
    user_res = await session.execute(
        select(User).where(User.id == user.id).options(selectinload(User.customer))
    )
    loaded_user = user_res.scalar_one()

    token = create_access_token(
        subject=str(loaded_user.id),
        role=loaded_user.role,
        email=loaded_user.email,
        customer_id=str(customer.id),
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_format_user_response(loaded_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with credentials",
)
async def login(
    req: LoginRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify credentials and issue a signed JWT access token."""
    email_clean = req.email.lower().strip()

    result = await session.execute(
        select(User)
        .where(func.lower(User.email) == email_clean)
        .options(selectinload(User.customer))
    )
    user = result.scalar_one_or_none()

    if not user:
        # Perform constant-time comparison to prevent timing attacks per spec 07
        verify_password(req.password, DUMMY_HASH)
        raise UnauthorizedException(code="invalid_credentials", message="Invalid email or password")

    if not verify_password(req.password, user.password_hash):
        raise UnauthorizedException(code="invalid_credentials", message="Invalid email or password")

    if not user.is_active:
        raise UnauthorizedException(code="invalid_credentials", message="Invalid email or password")

    customer_id_str = str(user.customer_id) if user.customer_id else None
    token = create_access_token(
        subject=str(user.id),
        role=user.role,
        email=user.email,
        customer_id=customer_id_str,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_format_user_response(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current user profile from token",
)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    # Ensure customer relationship is loaded
    user_res = await session.execute(
        select(User).where(User.id == current_user.id).options(selectinload(User.customer))
    )
    user = user_res.scalar_one()
    return _format_user_response(user)
