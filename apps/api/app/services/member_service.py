import secrets
from datetime import UTC, datetime, timedelta

from app.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.member import (
    Invitation,
    InvitationCreate,
    InvitationLookup,
    InvitationWithUrl,
    Member,
    MemberUpdate,
)
from app.services import audit_service, workspace_service

log = get_logger(__name__)

INVITE_TTL_DAYS = 7


def _user_metadata(user_id: str) -> tuple[str | None, str | None]:
    """Return (email, full_name) for an auth user."""
    db = get_supabase_admin()
    auth_res = db.auth.admin.get_user_by_id(user_id)
    if not (auth_res and auth_res.user):
        return (None, None)
    email = auth_res.user.email
    meta = auth_res.user.user_metadata or {}
    full_name = meta.get("full_name") if isinstance(meta, dict) else None
    return (email, full_name if isinstance(full_name, str) else None)


def list_members(workspace_id: str) -> list[Member]:
    db = get_supabase_admin()
    res = (
        db.table("workspace_members")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=False)
        .execute()
    )

    members: list[Member] = []
    for row in res.data or []:
        email, full_name = _user_metadata(row["user_id"])
        members.append(
            Member(
                id=row["id"],
                workspace_id=row["workspace_id"],
                user_id=row["user_id"],
                role=row["role"],
                email=email,
                full_name=full_name,
                invited_at=row.get("invited_at"),
                joined_at=row.get("joined_at"),
                created_at=row["created_at"],
            )
        )
    return members


def update_member(
    workspace_id: str, member_id: str, payload: MemberUpdate, actor_id: str
) -> Member:
    db = get_supabase_admin()
    existing = (
        db.table("workspace_members")
        .select("*")
        .eq("id", member_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Member not found")

    target = existing.data[0]
    target_user_id: str = target["user_id"]

    # If demoting an owner, make sure they're not the last one.
    if target["role"] == "owner" and payload.role != "owner":
        workspace_service.ensure_not_only_owner(workspace_id, target_user_id)

    res = (
        db.table("workspace_members")
        .update({"role": payload.role})
        .eq("id", member_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Member not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="member.role_changed",
        resource_type="workspace_member",
        resource_id=member_id,
        metadata={
            "target_user_id": target_user_id,
            "from": target["role"],
            "to": payload.role,
        },
    )

    email, full_name = _user_metadata(target_user_id)
    updated = res.data[0]
    return Member(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        user_id=updated["user_id"],
        role=updated["role"],
        email=email,
        full_name=full_name,
        invited_at=updated.get("invited_at"),
        joined_at=updated.get("joined_at"),
        created_at=updated["created_at"],
    )


def remove_member(workspace_id: str, member_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    existing = (
        db.table("workspace_members")
        .select("user_id, role")
        .eq("id", member_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise NotFoundError("Member not found")

    target = existing.data[0]
    if target["role"] == "owner":
        workspace_service.ensure_not_only_owner(workspace_id, target["user_id"])

    db.table("workspace_members").delete().eq("id", member_id).eq(
        "workspace_id", workspace_id
    ).execute()

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="member.removed",
        resource_type="workspace_member",
        resource_id=member_id,
        metadata={"target_user_id": target["user_id"]},
    )


# --- Invitations -------------------------------------------------------------


def list_invitations(workspace_id: str) -> list[Invitation]:
    db = get_supabase_admin()
    res = (
        db.table("invitations")
        .select("id, workspace_id, email, role, invited_by, expires_at, accepted_at, created_at")
        .eq("workspace_id", workspace_id)
        .is_("accepted_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return [Invitation.model_validate(row) for row in res.data or []]


def _build_invite_url(token: str) -> str:
    settings = get_settings()
    base = (
        settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:3001"
    ).rstrip("/")
    return f"{base}/accept-invite?token={token}"


def create_invitation(
    workspace_id: str, payload: InvitationCreate, actor_id: str
) -> InvitationWithUrl:
    db = get_supabase_admin()
    normalized_email = payload.email.lower().strip()

    existing_open = (
        db.table("invitations")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("email", normalized_email)
        .is_("accepted_at", "null")
        .limit(1)
        .execute()
    )
    if existing_open.data:
        raise ConflictError("An open invitation for this email already exists")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS)

    res = (
        db.table("invitations")
        .insert(
            {
                "workspace_id": workspace_id,
                "email": normalized_email,
                "role": payload.role,
                "invited_by": actor_id,
                "token": token,
                "expires_at": expires_at.isoformat(),
            }
        )
        .execute()
    )
    if not res.data:
        raise NotFoundError("Could not create invitation")
    row = res.data[0]

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="invitation.created",
        resource_type="invitation",
        resource_id=row["id"],
        metadata={"email": normalized_email, "role": payload.role},
    )

    invite_url = _build_invite_url(token)
    try:
        from app.services import email_service

        ws_res = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()
        workspace_name = ws_res.data[0]["name"] if ws_res.data else "your workspace"
        email_service.send_team_invite(
            to=normalized_email,
            workspace_name=workspace_name,
            accept_url=invite_url,
            role=payload.role,
        )
    except Exception as exc:
        log.error("invite_email_failed", invitation_id=row["id"], error=str(exc))

    return InvitationWithUrl(
        **{
            "id": row["id"],
            "workspace_id": row["workspace_id"],
            "email": row["email"],
            "role": row["role"],
            "invited_by": row["invited_by"],
            "expires_at": row["expires_at"],
            "accepted_at": row.get("accepted_at"),
            "created_at": row["created_at"],
            "url": invite_url,
        }
    )


def revoke_invitation(workspace_id: str, invitation_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("invitations")
        .delete()
        .eq("id", invitation_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Invitation not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="invitation.revoked",
        resource_type="invitation",
        resource_id=invitation_id,
    )


def lookup_invitation(token: str) -> InvitationLookup:
    db = get_supabase_admin()
    res = (
        db.table("invitations")
        .select("id, workspace_id, email, role, expires_at, accepted_at, workspaces(name, status)")
        .eq("token", token)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Invitation not found")
    row = res.data[0]

    ws = row.get("workspaces") or {}
    if ws.get("status") == "deleted":
        raise NotFoundError("Invitation not found")

    return InvitationLookup(
        id=row["id"],
        workspace_id=row["workspace_id"],
        workspace_name=ws.get("name", ""),
        email=row["email"],
        role=row["role"],
        expires_at=row["expires_at"],
        accepted_at=row.get("accepted_at"),
    )


def accept_invitation(token: str, user_id: str, user_email: str | None) -> Invitation:
    db = get_supabase_admin()
    res = db.table("invitations").select("*").eq("token", token).limit(1).execute()
    if not res.data:
        raise NotFoundError("Invitation not found")
    invite = res.data[0]

    if invite.get("accepted_at"):
        raise ConflictError("This invitation has already been accepted")

    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(UTC):
        raise ForbiddenError("This invitation has expired")

    if user_email and invite["email"].lower() != user_email.lower():
        raise ForbiddenError("This invitation is for a different email address")

    existing = (
        db.table("workspace_members")
        .select("id")
        .eq("workspace_id", invite["workspace_id"])
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        db.table("workspace_members").insert(
            {
                "workspace_id": invite["workspace_id"],
                "user_id": user_id,
                "role": invite["role"],
                "invited_by": invite["invited_by"],
                "invited_at": invite["created_at"],
                "joined_at": datetime.now(UTC).isoformat(),
            }
        ).execute()

    now_iso = datetime.now(UTC).isoformat()
    db.table("invitations").update({"accepted_at": now_iso}).eq("id", invite["id"]).execute()

    audit_service.write(
        actor_type="user",
        actor_id=user_id,
        workspace_id=invite["workspace_id"],
        action="invitation.accepted",
        resource_type="invitation",
        resource_id=invite["id"],
        metadata={"email": invite["email"], "role": invite["role"]},
    )

    invite["accepted_at"] = now_iso
    return Invitation.model_validate(invite)
