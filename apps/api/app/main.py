from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.config import get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging import configure_logging, get_logger
from app.routers import (
    admin,
    contact,
    conversations,
    health,
    locations,
    members,
    menu,
    orders,
    tickets,
    voice,
    webhooks,
    whatsapp,
    workspaces,
)


def _init_sentry() -> bool:
    """Best-effort Sentry init. Returns True if active."""
    settings = get_settings()
    if not settings.sentry_dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.1,
            integrations=[FastApiIntegration(), StarletteIntegration()],
        )
        return True
    except Exception:  # noqa: BLE001
        return False


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log = get_logger(__name__)
    settings = get_settings()
    sentry_active = _init_sentry()
    log.info(
        "api_starting",
        environment=settings.environment,
        version=__version__,
        cors_origins=settings.cors_origins_list,
        sentry_active=sentry_active,
    )
    yield
    log.info("api_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="VOAS AI API",
        version=__version__,
        description="Backend service for VOAS AI. See CLAUDE.md §3.5 for API conventions.",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(health.router, prefix="/v1")
    app.include_router(contact.router, prefix="/v1")
    app.include_router(workspaces.router, prefix="/v1")
    app.include_router(locations.router, prefix="/v1")
    app.include_router(members.router, prefix="/v1")
    app.include_router(members.public_router, prefix="/v1")
    app.include_router(tickets.router, prefix="/v1")
    app.include_router(conversations.router, prefix="/v1")
    app.include_router(orders.router, prefix="/v1")
    app.include_router(menu.router, prefix="/v1")
    app.include_router(voice.router, prefix="/v1")
    app.include_router(whatsapp.router, prefix="/v1")
    app.include_router(webhooks.router, prefix="/v1")
    app.include_router(admin.router, prefix="/v1")

    return app


app = create_app()
