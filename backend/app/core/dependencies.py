import uuid
from typing import Callable, List, Optional
from fastapi import Depends, Header, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import decode_access_token
from app.models.enums import Role
from app.models.ticket import Ticket
from app.models.user import User


async def get_current_user(
    authorization: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Validate bearer token, load user from DB, assert active status."""
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException(code="unauthenticated", message="Missing or malformed Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except Exception:
        raise UnauthorizedException(code="unauthenticated", message="Invalid or expired access token")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException(code="unauthenticated", message="Token missing subject claim")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedException(code="unauthenticated", message="Invalid subject format in token")

    # Always re-read user from database per spec 04 R2
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedException(code="unauthenticated", message="User account not found")

    if not user.is_active:
        raise UnauthorizedException(code="unauthenticated", message="User account is deactivated")

    return user


def require_role(*allowed_roles: Role) -> Callable:
    """Dependency asserting current user possesses one of the allowed roles."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in [r.value for r in allowed_roles]:
            raise ForbiddenException(code="forbidden", message="Insufficient permissions for this resource")
        return current_user

    return role_checker


async def require_customer_scope(
    current_user: User = Depends(get_current_user),
) -> Optional[uuid.UUID]:
    """Resolve customer_id from database user record for customer callers."""
    if current_user.role == Role.CUSTOMER.value:
        if not current_user.customer_id:
            raise UnauthorizedException(code="unauthenticated", message="Customer account has no linked customer record")
        return current_user.customer_id
    return None


async def require_ticket_access(
    ticket_id: uuid.UUID = Path(..., description="Ticket UUID"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Ticket:
    """Load ticket and assert that the authenticated user has permission to view it.
    
    Returns 404 (never 403) for inaccessible cross-tenant tickets to prevent probing.
    """
    result = await session.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise NotFoundException(code="not_found", message="Ticket not found")

    # Scoping rules per spec 04:
    if current_user.role == Role.ADMIN.value:
        return ticket
    elif current_user.role == Role.AGENT.value:
        # Agent can read tickets assigned to them or unassigned
        if ticket.assigned_agent_id is not None and ticket.assigned_agent_id != current_user.id:
            # Hide existence of other agents' tickets per spec 04
            raise NotFoundException(code="not_found", message="Ticket not found")
        return ticket
    elif current_user.role == Role.CUSTOMER.value:
        # Customer can only read tickets for their own customer record
        if ticket.customer_id != current_user.customer_id:
            # Hide existence of other customers' tickets per spec 04 / tenant isolation
            raise NotFoundException(code="not_found", message="Ticket not found")
        return ticket

    raise ForbiddenException(code="forbidden", message="Access denied")
