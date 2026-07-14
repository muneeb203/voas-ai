"""Per-staff Google Calendar: OAuth connect, token refresh, event push, and
free/busy read. All calls are best-effort — a Google failure never breaks a
booking; it just means that turn falls back to internal availability only.

Gated on google_client_id / google_client_secret: with no keys everything is a
no-op (not connected), so the salon flow works unchanged until an admin adds
the OAuth app credentials.
"""

from __future__ import annotations

import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin

log = get_logger(__name__)

_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
_CAL_BASE = "https://www.googleapis.com/calendar/v3"
_SCOPES = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.freebusy",
]
_TIMEOUT = 10.0

# (staff_id, date_iso) -> (expires_monotonic, busy intervals). Keeps the
# availability/prompt-context builders from hammering Google's freeBusy.
_freebusy_cache: dict[tuple[str, str], tuple[float, list[tuple[datetime, datetime]]]] = {}
_FREEBUSY_TTL = 60.0


def is_configured() -> bool:
    return get_settings().google_calendar_configured


# ── OAuth ────────────────────────────────────────────────────────────────────


def encode_state(staff_id: str, workspace_id: str, return_url: str) -> str:
    raw = json.dumps({"s": staff_id, "w": workspace_id, "r": return_url}).encode()
    return urlsafe_b64encode(raw).decode()


def decode_state(state: str) -> dict:
    try:
        return json.loads(urlsafe_b64decode(state.encode()).decode())
    except Exception:
        return {}


def build_auth_url(state: str) -> str:
    cfg = get_settings()
    params = {
        "client_id": cfg.google_client_id,
        "redirect_uri": cfg.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": " ".join(_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


def _exchange_code(code: str) -> dict | None:
    cfg = get_settings()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.post(
                _TOKEN_URL,
                data={
                    "code": code,
                    "client_id": cfg.google_client_id,
                    "client_secret": cfg.google_client_secret,
                    "redirect_uri": cfg.google_oauth_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
        if res.status_code != 200:
            log.error("google_token_exchange_failed", status=res.status_code, body=res.text[:300])
            return None
        return res.json()
    except Exception as exc:
        log.error("google_token_exchange_error", error=str(exc))
        return None


def _fetch_email(access_token: str) -> str | None:
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.get(_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if res.status_code == 200:
            return res.json().get("email")
    except Exception:
        pass
    return None


def complete_connect(code: str, staff_id: str, workspace_id: str) -> bool:
    """Exchange the auth code and store tokens for the staff member."""
    tokens = _exchange_code(code)
    if not tokens or not tokens.get("refresh_token"):
        # Google omits refresh_token if the user previously consented; prompt=consent
        # is set to avoid this, but guard anyway.
        return False
    access_token = tokens["access_token"]
    expiry = datetime.now(UTC) + timedelta(seconds=int(tokens.get("expires_in") or 3600))
    email = _fetch_email(access_token)
    db = get_supabase_admin()
    db.table("staff_google_calendar").upsert(
        {
            "staff_id": staff_id,
            "workspace_id": workspace_id,
            "google_email": email,
            "access_token": access_token,
            "refresh_token": tokens["refresh_token"],
            "token_expiry": expiry.isoformat(),
            "calendar_id": "primary",
        },
        on_conflict="staff_id",
    ).execute()
    return True


def disconnect(staff_id: str) -> None:
    get_supabase_admin().table("staff_google_calendar").delete().eq("staff_id", staff_id).execute()


def get_status(staff_id: str) -> dict:
    if not is_configured():
        return {"connected": False, "email": None}
    res = (
        get_supabase_admin()
        .table("staff_google_calendar")
        .select("google_email")
        .eq("staff_id", staff_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return {"connected": True, "email": res.data[0].get("google_email")}
    return {"connected": False, "email": None}


# ── Token access ────────────────────────────────────────────────────────────


def _connection(staff_id: str) -> dict | None:
    res = (
        get_supabase_admin()
        .table("staff_google_calendar")
        .select("*")
        .eq("staff_id", staff_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _valid_access_token(staff_id: str) -> tuple[str, str] | None:
    """Return (access_token, calendar_id), refreshing if expired. None if the
    staff member isn't connected or the refresh fails."""
    if not is_configured():
        return None
    conn = _connection(staff_id)
    if not conn:
        return None
    expiry = datetime.fromisoformat(str(conn["token_expiry"]).replace("Z", "+00:00"))
    if expiry - timedelta(seconds=60) > datetime.now(UTC):
        return conn["access_token"], conn.get("calendar_id") or "primary"

    cfg = get_settings()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.post(
                _TOKEN_URL,
                data={
                    "refresh_token": conn["refresh_token"],
                    "client_id": cfg.google_client_id,
                    "client_secret": cfg.google_client_secret,
                    "grant_type": "refresh_token",
                },
            )
        if res.status_code != 200:
            log.error("google_token_refresh_failed", status=res.status_code)
            return None
        data = res.json()
    except Exception as exc:
        log.error("google_token_refresh_error", error=str(exc))
        return None

    access_token = data["access_token"]
    new_expiry = datetime.now(UTC) + timedelta(seconds=int(data.get("expires_in") or 3600))
    get_supabase_admin().table("staff_google_calendar").update(
        {"access_token": access_token, "token_expiry": new_expiry.isoformat()}
    ).eq("staff_id", staff_id).execute()
    return access_token, conn.get("calendar_id") or "primary"


# ── Free/busy + events ──────────────────────────────────────────────────────


def freebusy(staff_id: str, start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """Busy intervals on the staff member's Google calendar, cached briefly."""
    if not is_configured():
        return []
    key = (staff_id, start.date().isoformat())
    cached = _freebusy_cache.get(key)
    now_mono = time.monotonic()
    if cached and cached[0] > now_mono:
        return cached[1]

    token = _valid_access_token(staff_id)
    if not token:
        return []
    access_token, calendar_id = token
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.post(
                f"{_CAL_BASE}/freeBusy",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "timeMin": start.astimezone(UTC).isoformat(),
                    "timeMax": end.astimezone(UTC).isoformat(),
                    "items": [{"id": calendar_id}],
                },
            )
        if res.status_code != 200:
            return []
        cal = (res.json().get("calendars") or {}).get(calendar_id) or {}
        intervals: list[tuple[datetime, datetime]] = []
        for b in cal.get("busy") or []:
            s = datetime.fromisoformat(b["start"].replace("Z", "+00:00"))
            e = datetime.fromisoformat(b["end"].replace("Z", "+00:00"))
            intervals.append((s, e))
    except Exception as exc:
        log.error("google_freebusy_error", staff_id=staff_id, error=str(exc))
        return []

    _freebusy_cache[key] = (now_mono + _FREEBUSY_TTL, intervals)
    return intervals


def push_event(
    staff_id: str, summary: str, description: str, starts_at: datetime, ends_at: datetime
) -> str | None:
    token = _valid_access_token(staff_id)
    if not token:
        return None
    access_token, calendar_id = token
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.post(
                f"{_CAL_BASE}/calendars/{calendar_id}/events",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "summary": summary,
                    "description": description,
                    "start": {"dateTime": starts_at.astimezone(UTC).isoformat()},
                    "end": {"dateTime": ends_at.astimezone(UTC).isoformat()},
                },
            )
        if res.status_code in (200, 201):
            return res.json().get("id")
        log.error("google_event_create_failed", status=res.status_code)
    except Exception as exc:
        log.error("google_event_create_error", staff_id=staff_id, error=str(exc))
    return None


def update_event(
    staff_id: str,
    event_id: str,
    summary: str,
    starts_at: datetime,
    ends_at: datetime,
) -> None:
    token = _valid_access_token(staff_id)
    if not token:
        return
    access_token, calendar_id = token
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            client.patch(
                f"{_CAL_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                json={
                    "summary": summary,
                    "start": {"dateTime": starts_at.astimezone(UTC).isoformat()},
                    "end": {"dateTime": ends_at.astimezone(UTC).isoformat()},
                },
            )
    except Exception as exc:
        log.error("google_event_update_error", staff_id=staff_id, error=str(exc))


def delete_event(staff_id: str, event_id: str) -> None:
    token = _valid_access_token(staff_id)
    if not token:
        return
    access_token, calendar_id = token
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            client.delete(
                f"{_CAL_BASE}/calendars/{calendar_id}/events/{event_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
    except Exception as exc:
        log.error("google_event_delete_error", staff_id=staff_id, error=str(exc))
