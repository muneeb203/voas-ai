from datetime import datetime

from pydantic import BaseModel, Field


class DayHours(BaseModel):
    open: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    close: str = Field(..., pattern=r"^\d{2}:\d{2}$")


# Each weekday key maps to either DayHours or None (closed for the day).
LocationHours = dict[str, DayHours | None]


class Location(BaseModel):
    id: str
    workspace_id: str
    name: str
    address: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    phone: str | None
    timezone: str
    hours: LocationHours | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=60)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str = Field(default="US", max_length=2)
    phone: str | None = Field(default=None, max_length=50)
    timezone: str = Field(default="America/New_York", max_length=80)
    hours: LocationHours | None = None
    is_active: bool = True


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=60)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=2)
    phone: str | None = Field(default=None, max_length=50)
    timezone: str | None = Field(default=None, max_length=80)
    hours: LocationHours | None = None
    is_active: bool | None = None
