from fastapi import APIRouter

from app.models.contact import ContactSubmission, ContactSubmissionCreate
from app.services import contact_service
from app.utils.responses import DataResponse, ok

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", response_model=DataResponse[ContactSubmission], status_code=201)
async def submit_contact(payload: ContactSubmissionCreate) -> DataResponse[ContactSubmission]:
    submission = await contact_service.create_submission(payload)
    return ok(submission)
