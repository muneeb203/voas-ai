from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.admin import AdminContactSubmission, AdminContactUpdate
from app.services import audit_service


def list_submissions(
    *, status: str | None = None, limit: int = 100
) -> list[AdminContactSubmission]:
    db = get_supabase_admin()
    query = db.table("contact_submissions").select("*").order("created_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return [AdminContactSubmission.model_validate(row) for row in res.data or []]


def update_submission(
    submission_id: str, payload: AdminContactUpdate, admin_id: str
) -> AdminContactSubmission:
    db = get_supabase_admin()
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        existing = (
            db.table("contact_submissions").select("*").eq("id", submission_id).limit(1).execute()
        )
        if not existing.data:
            raise NotFoundError("Submission not found")
        return AdminContactSubmission.model_validate(existing.data[0])

    # The schema doesn't have a `notes` column; if the user later wants it,
    # we'll add a migration. For V1 we only update `status`.
    safe = {k: v for k, v in changes.items() if k == "status"}
    if not safe:
        existing = (
            db.table("contact_submissions").select("*").eq("id", submission_id).limit(1).execute()
        )
        if not existing.data:
            raise NotFoundError("Submission not found")
        return AdminContactSubmission.model_validate(existing.data[0])

    res = db.table("contact_submissions").update(safe).eq("id", submission_id).execute()
    if not res.data:
        raise NotFoundError("Submission not found")

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        action="admin.contact.updated",
        resource_type="contact_submission",
        resource_id=submission_id,
        metadata=safe,
    )
    return AdminContactSubmission.model_validate(res.data[0])
