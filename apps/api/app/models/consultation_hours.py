from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ConsultationHoursDay(BaseModel):
    enabled: bool
    start: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class ConsultationHours(BaseModel):
    mon: ConsultationHoursDay
    tue: ConsultationHoursDay
    wed: ConsultationHoursDay
    thu: ConsultationHoursDay
    fri: ConsultationHoursDay
    sat: ConsultationHoursDay
    sun: ConsultationHoursDay


class ConsultationHoursResponse(BaseModel):
    workspace_id: str
    hours: ConsultationHours
    created_at: datetime
    updated_at: datetime


class ConsultationHoursUpdate(BaseModel):
    hours: ConsultationHours
