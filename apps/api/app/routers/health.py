from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.config import get_settings
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["health"])


class HealthPayload(BaseModel):
    status: str
    environment: str
    version: str


@router.get("/health", response_model=DataResponse[HealthPayload])
async def health() -> DataResponse[HealthPayload]:
    settings = get_settings()
    return ok(
        HealthPayload(
            status="ok",
            environment=settings.environment,
            version=__version__,
        )
    )
