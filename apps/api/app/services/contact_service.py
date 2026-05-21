from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.contact import ContactSubmission, ContactSubmissionCreate

log = get_logger(__name__)


async def create_submission(payload: ContactSubmissionCreate) -> ContactSubmission:
    db = get_supabase_admin()

    row = payload.model_dump(exclude_none=True)
    res = db.table("contact_submissions").insert(row).execute()

    if not res.data:
        log.error("contact_insert_failed", payload=row)
        raise AppError("Failed to record submission")

    inserted = res.data[0]
    log.info(
        "contact_submission_created",
        submission_id=inserted["id"],
        email=inserted["email"],
        source=inserted.get("source"),
    )

    return ContactSubmission.model_validate(inserted)
