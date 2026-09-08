from datetime import datetime
from pydantic import BaseModel


class LawAppointmentCreate(BaseModel):
    service_id: str | None = None
    starts_at: str
    customer_name: str
    customer_phone: str | None = None
    customer_email: str | None = None
    notes: str | None = None


class LawAppointment(BaseModel):
    id: str
    workspace_id: str
    service_id: str | None = None
    customer_name: str
    customer_phone: str | None = None
    customer_email: str | None = None
    starts_at: str
    status: str
    notes: str | None = None
    created_at: str
    updated_at: str
