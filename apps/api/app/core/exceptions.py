import contextlib
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger

log = get_logger(__name__)


class AppError(Exception):
    """Base class for VOAS application errors.

    Routers raise these; the global exception handler converts them
    to the standard `{"error": {"code", "message"}}` response shape.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"

    def __init__(self, message: str, *, details: Any | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class KioskLimitError(AppError):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    code = "KIOSK_LIMIT_REACHED"


class ServiceUnavailableError(AppError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "SERVICE_UNAVAILABLE"


class WorkspaceNotFoundError(NotFoundError):
    code = "WORKSPACE_NOT_FOUND"


def _error_payload(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    log.warning("app_error", code=exc.code, message=exc.message, details=exc.details)
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(exc.code, exc.message, exc.details),
    )


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
    }.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(code, str(exc.detail)),
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload("VALIDATION_ERROR", "Request validation failed", exc.errors()),
    )


def _workspace_id_from_path(path: str) -> str | None:
    """Pull the workspace id out of /v1/workspaces/{id}/... so a crash can be
    attributed to the business it happened to."""
    parts = [p for p in path.split("/") if p]
    with contextlib.suppress(ValueError, IndexError):
        return parts[parts.index("workspaces") + 1]
    return None


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled_exception", error=str(exc))

    # Surface the crash on the workspace's admin error log. Best-effort — this
    # handler must return a response no matter what.
    with contextlib.suppress(Exception):
        from app.services import error_log_service

        path = str(getattr(request, "url", "") and request.url.path)
        error_log_service.record(
            workspace_id=_workspace_id_from_path(path),
            kind="crash",
            source="unhandled_exception",
            message=f"{type(exc).__name__}: {exc}",
            context={"path": path, "method": getattr(request, "method", None)},
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload("INTERNAL_ERROR", "An unexpected error occurred"),
    )
