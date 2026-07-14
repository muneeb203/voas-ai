from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AppointmentStatus = Literal["pending", "confirmed", "completed", "cancelled", "no_show"]


# --- Services ---------------------------------------------------------------


class SalonService(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str | None = None
    price_cents: int
    duration_minutes: int
    buffer_after_minutes: int
    is_active: bool
    sort_order: int


class SalonServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    price_cents: int = Field(default=0, ge=0)
    duration_minutes: int = Field(default=30, gt=0, le=600)
    buffer_after_minutes: int = Field(default=0, ge=0, le=240)
    is_active: bool = True
    sort_order: int = 0


class SalonServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    price_cents: int | None = Field(default=None, ge=0)
    duration_minutes: int | None = Field(default=None, gt=0, le=600)
    buffer_after_minutes: int | None = Field(default=None, ge=0, le=240)
    is_active: bool | None = None
    sort_order: int | None = None


# --- Staff ------------------------------------------------------------------


class StaffHours(BaseModel):
    weekday: int = Field(..., ge=0, le=6)  # 0=Sunday .. 6=Saturday
    start_time: str  # 'HH:MM'
    end_time: str


class SalonStaff(BaseModel):
    id: str
    workspace_id: str
    location_id: str | None = None
    name: str
    title: str | None = None
    is_active: bool
    sort_order: int
    service_ids: list[str] = []
    hours: list[StaffHours] = []
    google_connected: bool = False
    google_email: str | None = None


class SalonStaffCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    title: str | None = Field(default=None, max_length=120)
    location_id: str | None = None
    is_active: bool = True
    sort_order: int = 0
    service_ids: list[str] = []
    hours: list[StaffHours] = []


class SalonStaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    title: str | None = Field(default=None, max_length=120)
    location_id: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    service_ids: list[str] | None = None
    hours: list[StaffHours] | None = None


# --- Appointments -----------------------------------------------------------


class SalonAppointment(BaseModel):
    id: str
    workspace_id: str
    location_id: str | None = None
    staff_id: str | None = None
    service_id: str | None = None
    service_name: str
    staff_name: str | None = None
    customer_phone: str | None = None
    customer_name: str | None = None
    starts_at: datetime
    ends_at: datetime
    status: AppointmentStatus
    price_cents: int
    notes: str | None = None
    checked_in_at: datetime | None = None
    google_event_id: str | None = None
    created_at: datetime


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class RescheduleInput(BaseModel):
    starts_at: datetime
    staff_id: str | None = None


# --- Availability / booking (also used by the AI tool) ----------------------


class AvailabilitySlot(BaseModel):
    starts_at: datetime
    ends_at: datetime
    staff_id: str
    staff_name: str


class AvailabilityResult(BaseModel):
    date: str
    service_id: str
    slots: list[AvailabilitySlot]


class BookAppointmentInput(BaseModel):
    service_id: str
    starts_at: datetime  # exact slot start (UTC)
    staff_id: str | None = None  # None → auto-assign a free, eligible staff member
    customer_name: str | None = Field(default=None, max_length=160)
    customer_phone: str | None = Field(default=None, max_length=40)
    location_id: str | None = None
    conversation_id: str | None = None
    notes: str | None = Field(default=None, max_length=1000)
