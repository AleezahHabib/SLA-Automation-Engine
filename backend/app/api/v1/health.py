from typing import Dict
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=Dict[str, str], summary="Liveness check")
async def health_check() -> Dict[str, str]:
    """Lightweight unauthenticated liveness check that does not query the database."""
    return {"status": "healthy"}
