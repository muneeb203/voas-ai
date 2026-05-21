from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ContactSubmissionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    message: str = Field(..., min_length=1, max_length=5000)
    source: str | None = Field(default=None, max_length=200)


class ContactSubmission(BaseModel):
    id: str
    name: str
    email: str
    company: str | None
    phone: str | None
    message: str
    source: str | None
    status: str
    created_at: datetime
