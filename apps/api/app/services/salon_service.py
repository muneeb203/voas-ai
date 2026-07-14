from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.salon import (
    AppointmentStatusUpdate,
    SalonAppointment,
    SalonService,
    SalonServiceCreate,
    SalonServiceUpdate,
    SalonStaff,
    SalonStaffCreate,
    SalonStaffUpdate,
    StaffHours,
)
from app.services import audit_service

# --- Services ---------------------------------------------------------------


def list_services(workspace_id: str, active_only: bool = False) -> list[SalonService]:
    db = get_supabase_admin()
    q = (
        db.table("salon_services")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("sort_order", desc=False)
    )
    if active_only:
        q = q.eq("is_active", True)
    return [SalonService(**row) for row in (q.execute().data or [])]


def create_service(
    workspace_id: str, payload: SalonServiceCreate, actor_id: str
) -> SalonService:
    db = get_supabase_admin()
    res = (
        db.table("salon_services")
        .insert({**payload.model_dump(), "workspace_id": workspace_id})
        .execute()
    )
    if not res.data:
        raise AppError("Could not create service")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.service.created",
        resource_type="salon_service",
        resource_id=res.data[0]["id"],
    )
    return SalonService(**res.data[0])


def update_service(
    workspace_id: str, service_id: str, payload: SalonServiceUpdate, actor_id: str
) -> SalonService:
    db = get_supabase_admin()
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        return _get_service(workspace_id, service_id)
    res = (
        db.table("salon_services")
        .update(changes)
        .eq("workspace_id", workspace_id)
        .eq("id", service_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Service not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.service.updated",
        resource_type="salon_service",
        resource_id=service_id,
    )
    return SalonService(**res.data[0])


def delete_service(workspace_id: str, service_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("salon_services")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("id", service_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Service not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.service.deleted",
        resource_type="salon_service",
        resource_id=service_id,
    )


def _get_service(workspace_id: str, service_id: str) -> SalonService:
    db = get_supabase_admin()
    res = (
        db.table("salon_services")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("id", service_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Service not found")
    return SalonService(**res.data[0])


# --- Staff ------------------------------------------------------------------


def _hydrate_staff(db, rows: list[dict]) -> list[SalonStaff]:
    if not rows:
        return []
    staff_ids = [r["id"] for r in rows]
    links = (
        db.table("salon_staff_services")
        .select("staff_id, service_id")
        .in_("staff_id", staff_ids)
        .execute()
    )
    hours = (
        db.table("salon_staff_hours")
        .select("staff_id, weekday, start_time, end_time")
        .in_("staff_id", staff_ids)
        .execute()
    )
    svc_by_staff: dict[str, list[str]] = {}
    for link in links.data or []:
        svc_by_staff.setdefault(link["staff_id"], []).append(link["service_id"])
    hours_by_staff: dict[str, list[StaffHours]] = {}
    for h in hours.data or []:
        hours_by_staff.setdefault(h["staff_id"], []).append(
            StaffHours(
                weekday=h["weekday"],
                start_time=str(h["start_time"])[:5],
                end_time=str(h["end_time"])[:5],
            )
        )
    return [
        SalonStaff(
            **r,
            service_ids=svc_by_staff.get(r["id"], []),
            hours=hours_by_staff.get(r["id"], []),
        )
        for r in rows
    ]


def list_staff(workspace_id: str, active_only: bool = False) -> list[SalonStaff]:
    db = get_supabase_admin()
    q = (
        db.table("salon_staff")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("sort_order", desc=False)
    )
    if active_only:
        q = q.eq("is_active", True)
    return _hydrate_staff(db, q.execute().data or [])


def _replace_links(db, staff_id: str, service_ids: list[str]) -> None:
    db.table("salon_staff_services").delete().eq("staff_id", staff_id).execute()
    if service_ids:
        db.table("salon_staff_services").insert(
            [{"staff_id": staff_id, "service_id": sid} for sid in service_ids]
        ).execute()


def _replace_hours(db, staff_id: str, hours: list[StaffHours]) -> None:
    db.table("salon_staff_hours").delete().eq("staff_id", staff_id).execute()
    if hours:
        db.table("salon_staff_hours").insert(
            [
                {
                    "staff_id": staff_id,
                    "weekday": h.weekday,
                    "start_time": h.start_time,
                    "end_time": h.end_time,
                }
                for h in hours
            ]
        ).execute()


def create_staff(workspace_id: str, payload: SalonStaffCreate, actor_id: str) -> SalonStaff:
    db = get_supabase_admin()
    row = {
        "workspace_id": workspace_id,
        "name": payload.name,
        "title": payload.title,
        "location_id": payload.location_id,
        "is_active": payload.is_active,
        "sort_order": payload.sort_order,
    }
    res = db.table("salon_staff").insert(row).execute()
    if not res.data:
        raise AppError("Could not create staff member")
    staff_id = res.data[0]["id"]
    _replace_links(db, staff_id, payload.service_ids)
    _replace_hours(db, staff_id, payload.hours)
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.staff.created",
        resource_type="salon_staff",
        resource_id=staff_id,
    )
    return _hydrate_staff(db, res.data)[0]


def update_staff(
    workspace_id: str, staff_id: str, payload: SalonStaffUpdate, actor_id: str
) -> SalonStaff:
    db = get_supabase_admin()
    fields = payload.model_dump(exclude_none=True, exclude={"service_ids", "hours"})
    if fields:
        res = (
            db.table("salon_staff")
            .update(fields)
            .eq("workspace_id", workspace_id)
            .eq("id", staff_id)
            .execute()
        )
        if not res.data:
            raise NotFoundError("Staff member not found")
    else:
        exists = (
            db.table("salon_staff")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("id", staff_id)
            .limit(1)
            .execute()
        )
        if not exists.data:
            raise NotFoundError("Staff member not found")
    if payload.service_ids is not None:
        _replace_links(db, staff_id, payload.service_ids)
    if payload.hours is not None:
        _replace_hours(db, staff_id, payload.hours)
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.staff.updated",
        resource_type="salon_staff",
        resource_id=staff_id,
    )
    fresh = (
        db.table("salon_staff")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("id", staff_id)
        .execute()
    )
    return _hydrate_staff(db, fresh.data or [])[0]


def delete_staff(workspace_id: str, staff_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("salon_staff")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("id", staff_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Staff member not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.staff.deleted",
        resource_type="salon_staff",
        resource_id=staff_id,
    )


# --- Appointments -----------------------------------------------------------


def list_appointments(
    workspace_id: str,
    status: str | None = None,
    from_iso: str | None = None,
    to_iso: str | None = None,
    limit: int = 200,
) -> list[SalonAppointment]:
    db = get_supabase_admin()
    q = (
        db.table("salon_appointments")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("starts_at", desc=True)
        .limit(limit)
    )
    if status:
        q = q.eq("status", status)
    if from_iso:
        q = q.gte("starts_at", from_iso)
    if to_iso:
        q = q.lte("starts_at", to_iso)
    return [SalonAppointment(**row) for row in (q.execute().data or [])]


def update_appointment_status(
    workspace_id: str, appointment_id: str, payload: AppointmentStatusUpdate, actor_id: str
) -> SalonAppointment:
    db = get_supabase_admin()
    res = (
        db.table("salon_appointments")
        .update({"status": payload.status})
        .eq("workspace_id", workspace_id)
        .eq("id", appointment_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Appointment not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="salon.appointment.status_changed",
        resource_type="salon_appointment",
        resource_id=appointment_id,
        metadata={"status": payload.status},
    )
    return SalonAppointment(**res.data[0])
