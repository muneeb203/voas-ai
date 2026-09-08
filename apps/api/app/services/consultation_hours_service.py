from app.core.supabase import get_supabase_admin
from app.models.consultation_hours import ConsultationHours, ConsultationHoursResponse
from app.core.exceptions import NotFoundError


def get_consultation_hours(workspace_id: str) -> ConsultationHoursResponse:
    """Get consultation hours for a workspace."""
    db = get_supabase_admin()
    res = (
        db.table("workspace_consultation_hours")
        .select("*")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise NotFoundError("Consultation hours not found for this workspace")

    data = res.data[0]
    return ConsultationHoursResponse(
        workspace_id=data["workspace_id"],
        hours=ConsultationHours(**data["hours"]),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


def upsert_consultation_hours(workspace_id: str, hours: ConsultationHours) -> ConsultationHoursResponse:
    """Create or update consultation hours for a workspace."""
    db = get_supabase_admin()

    # Check if record exists
    existing = (
        db.table("workspace_consultation_hours")
        .select("id")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    hours_dict = hours.model_dump()

    if existing.data:
        # Update existing
        res = (
            db.table("workspace_consultation_hours")
            .update({"hours": hours_dict})
            .eq("workspace_id", workspace_id)
            .execute()
        )
    else:
        # Create new
        res = (
            db.table("workspace_consultation_hours")
            .insert({"workspace_id": workspace_id, "hours": hours_dict})
            .execute()
        )

    if not res.data:
        raise Exception("Failed to save consultation hours")

    data = res.data[0]
    return ConsultationHoursResponse(
        workspace_id=data["workspace_id"],
        hours=ConsultationHours(**data["hours"]),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )
