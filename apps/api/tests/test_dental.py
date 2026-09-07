"""Tests for dental vertical: services, staff, appointments."""

import pytest
from datetime import datetime, timedelta, UTC
from fastapi.testclient import TestClient

from app.main import app
from app.core.exceptions import AppError

client = TestClient(app)

# Fixtures would go here in a real test suite with database setup
# For now, these are integration test skeletons that show the test structure

pytestmark = pytest.mark.asyncio


class TestDentalServices:
    """Dental services CRUD operations."""

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_list_services_empty(self):
        """GET /dental/services returns empty list for new workspace."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_create_service_owner_only(self):
        """POST /dental/services requires owner role."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_create_service_validates_duration(self):
        """POST /dental/services rejects duration < 1 minute."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_update_service_partial(self):
        """PATCH /dental/services/{id} updates only provided fields."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_delete_service(self):
        """DELETE /dental/services/{id} removes service."""
        pass


class TestDentalStaff:
    """Dental staff CRUD and hours management."""

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_create_staff_minimal(self):
        """POST /dental/staff creates staff with name only."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_update_staff_hours(self):
        """PUT /dental/staff/{id}/hours sets working hours for a weekday."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_staff_hours_with_break(self):
        """Staff hours can include break time (e.g., lunch)."""
        pass


class TestDentalAvailability:
    """Appointment availability queries."""

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_get_availability_empty_no_staff(self):
        """GET /dental/availability returns empty when no staff can perform service."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_get_availability_respects_hours(self):
        """Availability only shows times within staff working hours."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_get_availability_respects_buffer(self):
        """Buffer after appointment blocks next available slot."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_get_availability_one_month_limit(self):
        """Availability queries beyond one month return empty."""
        pass


class TestDentalAppointments:
    """Appointment booking and management."""

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_book_appointment_creates_confirmed(self):
        """POST /dental/appointments creates appointment in 'confirmed' status."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_book_appointment_rejects_conflict(self):
        """Booking fails if slot is already taken by another appointment."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_book_appointment_validates_staff_has_service(self):
        """Booking fails if staff member can't perform the requested service."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_reschedule_appointment(self):
        """PUT /dental/appointments/{id}/reschedule moves appointment to new time."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_update_appointment_status(self):
        """PUT /dental/appointments/{id}/status changes status (completed, cancelled, etc.)."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_list_appointments_filters_by_date(self):
        """GET /dental/appointments?date_start=...&date_end=... filters by range."""
        pass


class TestDentalVerticalGating:
    """Vertical enforcement — dental endpoints only work for dental workspaces."""

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_deny_dental_for_restaurant(self):
        """Calling /dental/* on a restaurant workspace raises INVALID_VERTICAL."""
        pass

    @pytest.mark.skip(reason="Requires test database and auth context")
    async def test_deny_dental_for_salon(self):
        """Calling /dental/* on a salon workspace raises INVALID_VERTICAL."""
        pass


# Example of a smoke test that could run without full database setup
def test_health_endpoint():
    """API health check (no auth required)."""
    response = client.get("/v1/health")
    assert response.status_code == 200
