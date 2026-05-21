from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.location import Location, LocationCreate, LocationUpdate
from app.services import audit_service


def list_locations(workspace_id: str) -> list[Location]:
    db = get_supabase_admin()
    res = (
        db.table("locations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=False)
        .execute()
    )
    return [Location.model_validate(row) for row in res.data or []]


def create_location(workspace_id: str, payload: LocationCreate, actor_id: str) -> Location:
    db = get_supabase_admin()
    row = {**payload.model_dump(exclude_none=True), "workspace_id": workspace_id}
    res = db.table("locations").insert(row).execute()
    if not res.data:
        raise AppError("Could not create location")

    location = res.data[0]
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="location.created",
        resource_type="location",
        resource_id=location["id"],
        metadata={"name": location["name"]},
    )
    return Location.model_validate(location)


def _get_owned(location_id: str, workspace_id: str) -> dict:
    db = get_supabase_admin()
    res = (
        db.table("locations")
        .select("*")
        .eq("id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Location not found")
    return res.data[0]


def update_location(
    workspace_id: str, location_id: str, payload: LocationUpdate, actor_id: str
) -> Location:
    db = get_supabase_admin()
    _get_owned(location_id, workspace_id)

    changes = payload.model_dump(exclude_none=True)
    if not changes:
        return Location.model_validate(_get_owned(location_id, workspace_id))

    res = (
        db.table("locations")
        .update(changes)
        .eq("id", location_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Location not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="location.updated",
        resource_type="location",
        resource_id=location_id,
        metadata={"changed_fields": list(changes.keys())},
    )
    return Location.model_validate(res.data[0])


def delete_location(workspace_id: str, location_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    _get_owned(location_id, workspace_id)

    res = (
        db.table("locations")
        .delete()
        .eq("id", location_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Location not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="location.deleted",
        resource_type="location",
        resource_id=location_id,
    )
