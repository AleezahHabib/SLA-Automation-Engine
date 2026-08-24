import asyncio
from contextlib import asynccontextmanager
import logging
import uuid
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_v1_router
from app.api.v1.health import router as health_router
from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.envelope import ErrorBody, ErrorDetail, ErrorEnvelope
from app.worker.sla_worker import sla_worker_loop

# Setup logging
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger("sla_engine")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager controlling SLA worker startup and clean shutdown."""
    worker_task = None
    if settings.SLA_WORKER_ENABLED:
        logger.info("Initializing SLA background worker task...")
        worker_task = asyncio.create_task(sla_worker_loop())

    yield

    if worker_task:
        logger.info("Stopping SLA background worker task...")
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            logger.info("SLA background worker cleanly terminated.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# 1. CORS Middleware per spec 16
cors_kwargs: Dict[str, Any] = {
    "allow_origins": settings.allowed_origins_list,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.ALLOWED_ORIGIN_REGEX:
    cors_kwargs["allow_origin_regex"] = settings.ALLOWED_ORIGIN_REGEX

app.add_middleware(CORSMiddleware, **cors_kwargs)


# 2. Request ID & Logging Middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# 3. Global Exception Handlers for Unified Error Envelope (spec 03 BE-ERRORS)
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    req_id = getattr(request.state, "request_id", None)
    details = [ErrorDetail(field=d.get("field"), message=d.get("message", "")) for d in exc.details] if exc.details else None

    envelope = ErrorEnvelope(
        error=ErrorBody(
            code=exc.code,
            message=exc.message,
            details=details,
            request_id=req_id,
        )
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(exclude_none=True),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", None)
    details: List[ErrorDetail] = []

    for err in exc.errors():
        loc = err.get("loc", [])
        field_name = str(loc[-1]) if loc else None
        msg = err.get("msg", "Invalid value")
        details.append(ErrorDetail(field=field_name, message=msg))

    envelope = ErrorEnvelope(
        error=ErrorBody(
            code="validation_error",
            message="Request validation failed",
            details=details,
            request_id=req_id,
        )
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope.model_dump(exclude_none=True),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    req_id = getattr(request.state, "request_id", None)
    code_map = {
        400: "bad_request",
        401: "unauthenticated",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "payload_too_large",
        415: "unsupported_media_type",
        422: "validation_error",
        429: "rate_limited",
        500: "server_error",
    }
    code = code_map.get(exc.status_code, "error")

    envelope = ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=str(exc.detail),
            details=None,
            request_id=req_id,
        )
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(exclude_none=True),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", None)
    logger.exception(f"Unhandled server error [request_id={req_id}]: {exc}")

    envelope = ErrorEnvelope(
        error=ErrorBody(
            code="server_error",
            message="An unexpected server error occurred",
            details=None,
            request_id=req_id,
        )
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=envelope.model_dump(exclude_none=True),
    )


# 4. Include Routers
from fastapi.responses import RedirectResponse

@app.get("/", include_in_schema=False)
async def root():
    """Redirect root browser requests directly to interactive Swagger API documentation."""
    return RedirectResponse(url="/docs")

app.include_router(health_router)
app.include_router(api_v1_router)

