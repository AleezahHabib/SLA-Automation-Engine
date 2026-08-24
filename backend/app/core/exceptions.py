from typing import Any, Dict, List, Optional


class AppException(Exception):
    """Base application exception mapped to standard error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class UnauthorizedException(AppException):
    def __init__(self, code: str = "unauthenticated", message: str = "Authentication required"):
        super().__init__(code=code, message=message, status_code=401)


class ForbiddenException(AppException):
    def __init__(self, code: str = "forbidden", message: str = "Insufficient permissions"):
        super().__init__(code=code, message=message, status_code=403)


class NotFoundException(AppException):
    def __init__(self, code: str = "not_found", message: str = "Resource not found"):
        super().__init__(code=code, message=message, status_code=404)


class ConflictException(AppException):
    def __init__(
        self,
        code: str = "conflict",
        message: str = "Conflicting operation or illegal transition",
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(code=code, message=message, status_code=409, details=details)


class ValidationException(AppException):
    def __init__(
        self,
        code: str = "validation_error",
        message: str = "Validation failed",
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(code=code, message=message, status_code=422, details=details)


class PayloadTooLargeException(AppException):
    def __init__(self, code: str = "payload_too_large", message: str = "File exceeds maximum size limit"):
        super().__init__(code=code, message=message, status_code=413)


class UnsupportedMediaTypeException(AppException):
    def __init__(self, code: str = "unsupported_media_type", message: str = "Unsupported media type"):
        super().__init__(code=code, message=message, status_code=415)
