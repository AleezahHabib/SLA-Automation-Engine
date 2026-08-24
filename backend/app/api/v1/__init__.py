from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.customers import router as customers_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.comments import router as comments_router
from app.api.v1.attachments import router as attachments_router
from app.api.v1.audit import router as audit_router
from app.api.v1.agents import router as agents_router
from app.api.v1.metrics import router as metrics_router

api_v1_router = APIRouter()

# Include all API v1 subrouters
api_v1_router.include_router(auth_router)
api_v1_router.include_router(customers_router)
api_v1_router.include_router(tickets_router)
api_v1_router.include_router(comments_router)
api_v1_router.include_router(attachments_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(agents_router)
api_v1_router.include_router(metrics_router)

__all__ = ["api_v1_router"]
