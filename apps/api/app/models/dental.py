"""Dental vertical models — services, staff, appointments, availability."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DentalService(BaseModel):
	"""A dental procedure (cleaning, root canal, filling, etc.)."""
	id: str
	workspace_id: str
	name: str
	description: Optional[str] = None
	duration_minutes: int
	buffer_after_minutes: int = 0
	price_cents: int
	is_active: bool = True
	sort_order: int = 0
	created_at: datetime
	updated_at: datetime

	class Config:
		from_attributes = True


class DentalServiceCreate(BaseModel):
	"""Input to create a dental service."""
	name: str = Field(..., min_length=1, max_length=200)
	description: Optional[str] = Field(None, max_length=1000)
	duration_minutes: int = Field(..., ge=1, le=480)
	buffer_after_minutes: int = Field(default=0, ge=0, le=120)
	price_cents: int = Field(default=0, ge=0)


class DentalServiceUpdate(BaseModel):
	"""Input to update a dental service."""
	name: Optional[str] = Field(None, min_length=1, max_length=200)
	description: Optional[str] = Field(None, max_length=1000)
	duration_minutes: Optional[int] = Field(None, ge=1, le=480)
	buffer_after_minutes: Optional[int] = Field(None, ge=0, le=120)
	price_cents: Optional[int] = Field(None, ge=0)
	is_active: Optional[bool] = None


class DentalStaff(BaseModel):
	"""A dental professional (dentist, hygienist, assistant)."""
	id: str
	workspace_id: str
	name: str
	title: Optional[str] = None
	email: Optional[str] = None
	phone: Optional[str] = None
	is_active: bool = True
	sort_order: int = 0
	created_at: datetime
	updated_at: datetime

	class Config:
		from_attributes = True


class DentalStaffCreate(BaseModel):
	"""Input to create dental staff."""
	name: str = Field(..., min_length=1, max_length=200)
	title: Optional[str] = Field(None, max_length=100)
	email: Optional[str] = Field(None, max_length=200)
	phone: Optional[str] = Field(None, max_length=40)


class DentalStaffUpdate(BaseModel):
	"""Input to update dental staff."""
	name: Optional[str] = Field(None, min_length=1, max_length=200)
	title: Optional[str] = Field(None, max_length=100)
	email: Optional[str] = Field(None, max_length=200)
	phone: Optional[str] = Field(None, max_length=40)
	is_active: Optional[bool] = None


class AvailabilitySlot(BaseModel):
	"""An available time slot for a dental appointment."""
	starts_at: datetime
	ends_at: datetime
	staff_id: str
	staff_name: str


class AvailabilityResult(BaseModel):
	"""Result of querying available appointment times."""
	date: str  # ISO date string (YYYY-MM-DD)
	service_id: str
	slots: list[AvailabilitySlot]


class BookAppointmentInput(BaseModel):
	"""Input to book a dental appointment."""
	service_id: str
	staff_id: str
	starts_at: datetime
	customer_name: Optional[str] = Field(None, max_length=200)
	customer_phone: Optional[str] = Field(None, max_length=40)
	customer_email: Optional[str] = Field(None, max_length=200)
	location_id: Optional[str] = None
	conversation_id: Optional[str] = None
	notes: Optional[str] = Field(None, max_length=1000)


class DentalAppointment(BaseModel):
	"""A booked dental appointment."""
	id: str
	workspace_id: str
	location_id: Optional[str] = None
	service_id: str
	staff_id: str
	customer_id: Optional[str] = None
	customer_name: Optional[str] = None
	customer_phone: Optional[str] = None
	customer_email: Optional[str] = None
	starts_at: datetime
	ends_at: datetime
	status: str  # pending, confirmed, completed, cancelled, no_show
	notes: Optional[str] = None
	conversation_id: Optional[str] = None
	google_event_id: Optional[str] = None
	created_at: datetime
	updated_at: datetime

	class Config:
		from_attributes = True


class RescheduleInput(BaseModel):
	"""Input to reschedule a dental appointment."""
	new_starts_at: datetime = Field(..., alias="starts_at")
	staff_id: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
	"""Input to update appointment status."""
	status: str = Field(..., pattern="^(pending|confirmed|completed|cancelled|no_show)$")
