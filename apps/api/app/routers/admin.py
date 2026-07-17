from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Query, status
from pydantic import BaseModel, Field

from app.core.supabase import get_supabase_admin
from app.deps import AdminContextDep
from app.models.admin import (
    AdminActivityItem,
    AdminAuditEntry,
    AdminContactSubmission,
    AdminContactUpdate,
    AdminErrorLogEntry,
    AdminGlobalLogItem,
    AdminKnowledgeBase,
    AdminUsageHistoryPoint,
    AdminUserSummary,
    AdminWorkspaceDetail,
    AdminWorkspaceListItem,
)
from app.models.billing import (
    AdminBillingUpdate,
    AdminWorkspaceUsageRow,
    CreditGrant,
    CreditGrantCreate,
    UsageSummary,
)
from app.models.notification import Announcement, AnnouncementCreate
from app.models.ticket import (
    Ticket,
    TicketMessage,
    TicketStatus,
    TicketWithMessages,
)
from app.models.voice import VoiceSettings
from app.models.workspace import Workspace
from app.services import (
    admin_activity_service,
    admin_audit_service,
    admin_contact_service,
    admin_kb_service,
    admin_ticket_service,
    admin_user_service,
    admin_workspace_service,
    announcement_service,
    billing_service,
    error_log_service,
    impersonation_service,
    voice_service,
)
from app.utils.responses import DataResponse, ok

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- Workspaces ------------------------------------------------------


@router.get("/workspaces", response_model=DataResponse[list[AdminWorkspaceListItem]])
async def list_workspaces(
    _: AdminContextDep,
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    plan: str | None = Query(default=None),
) -> DataResponse[list[AdminWorkspaceListItem]]:
    workspaces = admin_workspace_service.list_workspaces(
        search=search,
        status=status_filter,  # type: ignore[arg-type]
        plan=plan,
    )
    return ok(workspaces)


@router.get("/workspaces/{workspace_id}", response_model=DataResponse[AdminWorkspaceDetail])
async def get_workspace(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[AdminWorkspaceDetail]:
    detail = admin_workspace_service.get_detail(workspace_id)
    return ok(detail)


@router.post("/workspaces/{workspace_id}/suspend", response_model=DataResponse[Workspace])
async def suspend_workspace(workspace_id: str, ctx: AdminContextDep) -> DataResponse[Workspace]:
    workspace = admin_workspace_service.suspend(workspace_id, ctx.admin_id)
    return ok(workspace)


@router.post("/workspaces/{workspace_id}/restore", response_model=DataResponse[Workspace])
async def restore_workspace(workspace_id: str, ctx: AdminContextDep) -> DataResponse[Workspace]:
    workspace = admin_workspace_service.restore(workspace_id, ctx.admin_id)
    return ok(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: str, ctx: AdminContextDep) -> None:
    admin_workspace_service.soft_delete(workspace_id, ctx.admin_id)


# ---------- Impersonation ---------------------------------------------------


class ImpersonationPayload(BaseModel):
    workspace_id: str
    workspace_name: str
    started_at: str


@router.get(
    "/workspaces/{workspace_id}/activity",
    response_model=DataResponse[list[AdminActivityItem]],
)
async def get_workspace_activity(
    workspace_id: str,
    _: AdminContextDep,
    limit: int = Query(default=50, ge=1, le=200),
) -> DataResponse[list[AdminActivityItem]]:
    return ok(admin_activity_service.list_activity(workspace_id, limit=limit))


@router.get("/logs", response_model=DataResponse[list[AdminGlobalLogItem]])
async def get_global_log(
    _: AdminContextDep,
    workspace_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
) -> DataResponse[list[AdminGlobalLogItem]]:
    return ok(admin_activity_service.list_global_log(workspace_id, limit=limit))


@router.get(
    "/workspaces/{workspace_id}/usage-history",
    response_model=DataResponse[list[AdminUsageHistoryPoint]],
)
async def get_workspace_usage_history(
    workspace_id: str,
    _: AdminContextDep,
    days: int = Query(default=30, ge=1, le=90),
) -> DataResponse[list[AdminUsageHistoryPoint]]:
    return ok(admin_activity_service.usage_history(workspace_id, days=days))


@router.get(
    "/workspaces/{workspace_id}/errors",
    response_model=DataResponse[list[AdminErrorLogEntry]],
)
async def get_workspace_errors(
    workspace_id: str,
    _: AdminContextDep,
    limit: int = Query(default=100, ge=1, le=200),
) -> DataResponse[list[AdminErrorLogEntry]]:
    return ok(error_log_service.list_for_workspace(workspace_id, limit=limit))


@router.get(
    "/workspaces/{workspace_id}/knowledge-base",
    response_model=DataResponse[AdminKnowledgeBase],
)
async def get_workspace_knowledge_base(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[AdminKnowledgeBase]:
    return ok(admin_kb_service.get_knowledge_base(workspace_id))


class AdminVoiceModelBody(BaseModel):
    model: str = Field(..., min_length=1, max_length=80)


@router.patch(
    "/workspaces/{workspace_id}/voice-model",
    response_model=DataResponse[VoiceSettings],
)
async def set_workspace_voice_model(
    workspace_id: str,
    body: AdminVoiceModelBody,
    ctx: AdminContextDep,
    background_tasks: BackgroundTasks,
) -> DataResponse[VoiceSettings]:
    settings = voice_service.set_model_admin(workspace_id, body.model, ctx.user.id)
    background_tasks.add_task(voice_service.sync_assistant_now, workspace_id)
    return ok(settings)


@router.post(
    "/workspaces/{workspace_id}/impersonate",
    response_model=DataResponse[ImpersonationPayload],
)
async def start_impersonation(
    workspace_id: str, ctx: AdminContextDep
) -> DataResponse[ImpersonationPayload]:
    data = impersonation_service.start(workspace_id, ctx.admin_id, ctx.user.id)
    return ok(ImpersonationPayload(**data))


class ExitImpersonationBody(BaseModel):
    workspace_id: str | None = None


@router.post("/impersonate/exit", status_code=status.HTTP_204_NO_CONTENT)
async def end_impersonation(body: ExitImpersonationBody, ctx: AdminContextDep) -> None:
    impersonation_service.end(body.workspace_id, ctx.admin_id, ctx.user.id)


# ---------- Users -----------------------------------------------------------


@router.get("/users", response_model=DataResponse[list[AdminUserSummary]])
async def list_users(_: AdminContextDep) -> DataResponse[list[AdminUserSummary]]:
    return ok(admin_user_service.list_users())


# ---------- Tickets (admin inbox) ------------------------------------------


@router.get("/tickets", response_model=DataResponse[list[Ticket]])
async def list_tickets(
    _: AdminContextDep,
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    workspace_id: str | None = Query(default=None),
    assigned_admin_id: str | None = Query(default=None, alias="assigned"),
) -> DataResponse[list[Ticket]]:
    tickets = admin_ticket_service.list_all_tickets(
        status=status_filter,
        priority=priority,
        workspace_id=workspace_id,
        assigned_admin_id=assigned_admin_id,
    )
    return ok(tickets)


@router.get("/tickets/{ticket_id}", response_model=DataResponse[TicketWithMessages])
async def get_ticket(ticket_id: str, _: AdminContextDep) -> DataResponse[TicketWithMessages]:
    return ok(admin_ticket_service.get_ticket(ticket_id))


class AdminReplyPayload(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    is_internal_note: bool = False


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=DataResponse[TicketMessage],
    status_code=status.HTTP_201_CREATED,
)
async def admin_reply(
    ticket_id: str, payload: AdminReplyPayload, ctx: AdminContextDep
) -> DataResponse[TicketMessage]:
    message = admin_ticket_service.reply(
        ticket_id, ctx.admin_id, payload.body, is_internal_note=payload.is_internal_note
    )
    return ok(message)


class AdminTicketUpdate(BaseModel):
    status: TicketStatus | None = None
    assigned_admin_id: str | None = Field(default=None)


@router.patch("/tickets/{ticket_id}", response_model=DataResponse[Ticket])
async def admin_update_ticket(
    ticket_id: str, payload: AdminTicketUpdate, ctx: AdminContextDep
) -> DataResponse[Ticket]:
    ticket: Ticket | None = None
    if payload.status is not None:
        ticket = admin_ticket_service.update_status(ticket_id, ctx.admin_id, payload.status)
    if "assigned_admin_id" in payload.model_fields_set:
        ticket = admin_ticket_service.assign(ticket_id, ctx.admin_id, payload.assigned_admin_id)
    if ticket is None:
        ticket = admin_ticket_service.get_ticket(ticket_id)  # no-op echo
    return ok(ticket)  # type: ignore[arg-type]


# ---------- Contact submissions ---------------------------------------------


@router.get("/contact-submissions", response_model=DataResponse[list[AdminContactSubmission]])
async def list_contact_submissions(
    _: AdminContextDep, status_filter: str | None = Query(default=None, alias="status")
) -> DataResponse[list[AdminContactSubmission]]:
    return ok(admin_contact_service.list_submissions(status=status_filter))


@router.patch(
    "/contact-submissions/{submission_id}",
    response_model=DataResponse[AdminContactSubmission],
)
async def update_contact_submission(
    submission_id: str, payload: AdminContactUpdate, ctx: AdminContextDep
) -> DataResponse[AdminContactSubmission]:
    return ok(admin_contact_service.update_submission(submission_id, payload, ctx.admin_id))


# ---------- Audit log -------------------------------------------------------


@router.get("/audit-logs", response_model=DataResponse[list[AdminAuditEntry]])
async def list_audit_logs(
    _: AdminContextDep,
    actor_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    workspace_id: str | None = Query(default=None),
) -> DataResponse[list[AdminAuditEntry]]:
    return ok(
        admin_audit_service.list_entries(
            actor_type=actor_type, action=action, workspace_id=workspace_id
        )
    )


# ---------- Announcements ---------------------------------------------------


@router.get("/announcements", response_model=DataResponse[list[Announcement]])
async def list_announcements(_: AdminContextDep) -> DataResponse[list[Announcement]]:
    return ok(announcement_service.list_announcements())


@router.post(
    "/announcements",
    response_model=DataResponse[Announcement],
    status_code=status.HTTP_201_CREATED,
)
async def publish_announcement(
    payload: AnnouncementCreate,
    ctx: AdminContextDep,
) -> DataResponse[Announcement]:
    return ok(
        announcement_service.publish(
            payload,
            admin_id=ctx.admin_id,
            admin_user_id=ctx.user.id,
        )
    )


# ---------- Billing / usage -------------------------------------------------


@router.get("/usage", response_model=DataResponse[list[AdminWorkspaceUsageRow]])
async def list_usage(_: AdminContextDep) -> DataResponse[list[AdminWorkspaceUsageRow]]:
    return ok(billing_service.list_admin_usage())


@router.get(
    "/workspaces/{workspace_id}/billing/usage",
    response_model=DataResponse[UsageSummary],
)
async def get_workspace_usage(workspace_id: str, _: AdminContextDep) -> DataResponse[UsageSummary]:
    return ok(billing_service.get_usage_summary(workspace_id))


@router.get(
    "/workspaces/{workspace_id}/billing/grants",
    response_model=DataResponse[list[CreditGrant]],
)
async def list_workspace_grants(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[list[CreditGrant]]:
    return ok(billing_service.list_grants(workspace_id))


@router.post(
    "/workspaces/{workspace_id}/billing/grants",
    response_model=DataResponse[CreditGrant],
    status_code=status.HTTP_201_CREATED,
)
async def grant_workspace_credits(
    workspace_id: str,
    payload: CreditGrantCreate,
    ctx: AdminContextDep,
) -> DataResponse[CreditGrant]:
    return ok(billing_service.grant_credits(workspace_id, payload, ctx.admin_id))


class CreditDeductBody(BaseModel):
    credit_type: str
    amount: int = Field(gt=0)
    reason: str | None = None


class CreditDeductResult(BaseModel):
    deducted: int


@router.post(
    "/workspaces/{workspace_id}/billing/deduct",
    response_model=DataResponse[CreditDeductResult],
)
async def deduct_workspace_credits(
    workspace_id: str,
    payload: CreditDeductBody,
    ctx: AdminContextDep,
) -> DataResponse[CreditDeductResult]:
    deducted = billing_service.deduct_credits(
        workspace_id, payload.credit_type, payload.amount, payload.reason, ctx.admin_id
    )
    return ok(CreditDeductResult(deducted=deducted))


@router.patch(
    "/workspaces/{workspace_id}/billing",
    response_model=DataResponse[UsageSummary],
)
async def update_workspace_billing(
    workspace_id: str,
    payload: AdminBillingUpdate,
    ctx: AdminContextDep,
) -> DataResponse[UsageSummary]:
    return ok(billing_service.update_workspace_billing(workspace_id, payload, ctx.admin_id))


# ---------- Kiosk settings (admin-controlled) ----------------------------------


class AdminKioskSettings(BaseModel):
    kiosk_enabled: bool
    max_kiosk_urls: int
    theme: str
    session_lock_enabled: bool
    kiosk_monthly_limit: int = 500
    kiosk_credits_balance: int = 0
    kiosk_credits_used_this_month: int = 0
    kiosk_month_start: str | None = None


class AdminKioskSettingsUpdate(BaseModel):
    kiosk_enabled: bool | None = None
    max_kiosk_urls: int | None = Field(default=None, ge=1, le=10)
    kiosk_monthly_limit: int | None = Field(default=None, ge=0)


class KioskTopupBody(BaseModel):
    amount: int = Field(..., ge=1, le=100_000)


_KIOSK_SELECT = (
    "kiosk_enabled, max_kiosk_urls, theme, session_lock_enabled, "
    "kiosk_monthly_limit, kiosk_credits_balance, kiosk_credits_used_this_month, kiosk_month_start"
)


# ---------- Kiosk performance metrics -----------------------------------------


class KioskMetricsWindow(BaseModel):
    total_turns: int
    deepgram_turns: int
    avg_confidence: float | None = None  # 0..1, over Deepgram turns only
    avg_chat_ms: int | None = None
    avg_tts_ms: int | None = None
    orders_placed: int


class AdminKioskMetrics(BaseModel):
    window_7d: KioskMetricsWindow
    window_30d: KioskMetricsWindow
    window_all: KioskMetricsWindow


def _kiosk_metrics_window(db, workspace_id: str, since: str | None) -> KioskMetricsWindow:
    res = db.rpc(
        "kiosk_metrics_summary",
        {"p_workspace_id": workspace_id, "p_since": since},
    ).execute()
    row = (res.data or [{}])[0] if res.data else {}

    def _as_int(value: object) -> int | None:
        return int(value) if value is not None else None

    conf = row.get("avg_confidence")
    return KioskMetricsWindow(
        total_turns=int(row.get("total_turns") or 0),
        deepgram_turns=int(row.get("deepgram_turns") or 0),
        avg_confidence=float(conf) if conf is not None else None,
        avg_chat_ms=_as_int(row.get("avg_chat_ms")),
        avg_tts_ms=_as_int(row.get("avg_tts_ms")),
        orders_placed=int(row.get("orders_placed") or 0),
    )


@router.get(
    "/workspaces/{workspace_id}/kiosk-metrics",
    response_model=DataResponse[AdminKioskMetrics],
)
async def get_admin_kiosk_metrics(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[AdminKioskMetrics]:
    db = get_supabase_admin()
    now = datetime.now(UTC)
    return ok(
        AdminKioskMetrics(
            window_7d=_kiosk_metrics_window(
                db, workspace_id, (now - timedelta(days=7)).isoformat()
            ),
            window_30d=_kiosk_metrics_window(
                db, workspace_id, (now - timedelta(days=30)).isoformat()
            ),
            window_all=_kiosk_metrics_window(db, workspace_id, None),
        )
    )


@router.get(
    "/workspaces/{workspace_id}/kiosk-settings",
    response_model=DataResponse[AdminKioskSettings],
)
async def get_admin_kiosk_settings(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[AdminKioskSettings]:
    db = get_supabase_admin()
    res = (
        db.table("workspace_kiosk_settings")
        .select(_KIOSK_SELECT)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return ok(AdminKioskSettings(**res.data[0]))
    return ok(
        AdminKioskSettings(
            kiosk_enabled=False, max_kiosk_urls=1, theme="gradient", session_lock_enabled=False
        )
    )


@router.patch(
    "/workspaces/{workspace_id}/kiosk-settings",
    response_model=DataResponse[AdminKioskSettings],
)
async def update_admin_kiosk_settings(
    workspace_id: str,
    body: AdminKioskSettingsUpdate,
    ctx: AdminContextDep,
) -> DataResponse[AdminKioskSettings]:
    db = get_supabase_admin()

    # Deactivate oldest excess active tokens whenever max_kiosk_urls is being set
    if body.max_kiosk_urls is not None:
        active_tokens = (
            db.table("kiosk_tokens")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .execute()
        )
        excess_ids = [row["id"] for row in active_tokens.data[body.max_kiosk_urls :]]
        if excess_ids:
            db.table("kiosk_tokens").update({"is_active": False}).in_("id", excess_ids).execute()

    existing = (
        db.table("workspace_kiosk_settings")
        .select(_KIOSK_SELECT)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    existing_row = existing.data[0] if existing.data else {}

    changes: dict = {"updated_at": datetime.now(UTC).isoformat()}
    if body.kiosk_enabled is not None:
        changes["kiosk_enabled"] = body.kiosk_enabled
    if body.max_kiosk_urls is not None:
        changes["max_kiosk_urls"] = body.max_kiosk_urls
    if body.kiosk_monthly_limit is not None:
        changes["kiosk_monthly_limit"] = body.kiosk_monthly_limit
        # First time monthly limit is set: seed balance and start the billing cycle
        if not existing_row.get("kiosk_month_start"):
            changes["kiosk_month_start"] = datetime.now(UTC).isoformat()
            changes["kiosk_credits_balance"] = body.kiosk_monthly_limit

    if existing_row:
        res = (
            db.table("workspace_kiosk_settings")
            .update(changes)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    else:
        changes["workspace_id"] = workspace_id
        changes.setdefault("kiosk_enabled", False)
        changes.setdefault("max_kiosk_urls", 1)
        changes.setdefault("theme", "gradient")
        changes.setdefault("session_lock_enabled", False)
        changes.setdefault("kiosk_monthly_limit", 500)
        res = db.table("workspace_kiosk_settings").insert(changes).execute()

    return ok(AdminKioskSettings(**res.data[0]))


@router.post(
    "/workspaces/{workspace_id}/kiosk-topup",
    response_model=DataResponse[AdminKioskSettings],
)
async def topup_kiosk_credits(
    workspace_id: str,
    body: KioskTopupBody,
    ctx: AdminContextDep,
) -> DataResponse[AdminKioskSettings]:
    db = get_supabase_admin()

    existing = (
        db.table("workspace_kiosk_settings")
        .select(_KIOSK_SELECT)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    now_iso = datetime.now(UTC).isoformat()

    if existing.data:
        current = existing.data[0]
        new_balance = (current.get("kiosk_credits_balance") or 0) + body.amount
        changes: dict = {
            "kiosk_credits_balance": new_balance,
            "updated_at": now_iso,
        }
        # Also start billing cycle if not yet started
        if not current.get("kiosk_month_start"):
            changes["kiosk_month_start"] = now_iso
        res = (
            db.table("workspace_kiosk_settings")
            .update(changes)
            .eq("workspace_id", workspace_id)
            .execute()
        )
    else:
        res = (
            db.table("workspace_kiosk_settings")
            .insert({
                "workspace_id": workspace_id,
                "kiosk_credits_balance": body.amount,
                "kiosk_month_start": now_iso,
                "theme": "gradient",
                "session_lock_enabled": False,
                "kiosk_enabled": False,
                "max_kiosk_urls": 1,
                "updated_at": now_iso,
            })
            .execute()
        )

    db.table("audit_logs").insert({
        "actor_type": "admin",
        "actor_id": ctx.admin_id,
        "workspace_id": workspace_id,
        "action": "kiosk.credits.topup",
        "resource_type": "workspace_kiosk_settings",
        "metadata": {"amount": body.amount},
    }).execute()

    return ok(AdminKioskSettings(**res.data[0]))
