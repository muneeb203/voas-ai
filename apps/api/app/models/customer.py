from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class Customer(BaseModel):
    id: str
    workspace_id: str
    phone: str | None
    name: str | None
    email: str | None
    total_orders: int
    total_spent_cents: int
    first_seen: datetime
    last_seen: datetime
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime


class CustomerUpsert(BaseModel):
    phone: str | None = Field(default=None, max_length=50)
    name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    tags: list[str] | None = None


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    tags: list[str] | None = None
