"""In-process rate limiting middleware.

Addresses the pentest findings on unthrottled API access. Two fixed-window
limits, both driven by the values already in config:

* per-IP global   — every request, `rate_limit_global_per_hour` / hour
* per-user writes — POST/PUT/PATCH/DELETE, `rate_limit_writes_per_minute` / min

CAVEAT (documented on purpose): the counters live in this process's memory, so
each running instance keeps its own tally. With N backend instances the
effective limit is up to N times the configured number, and a restart resets it.
That's fine as an abuse/DoS backstop — it turns "unlimited" into "bounded" —
but it is NOT a distributed limiter. Swap the `_Store` for Redis if you need
one shared ceiling across instances. It also does nothing for the Supabase Auth
and direct-from-browser Supabase REST paths, which never reach this process.

Auth endpoints (login/reset) are Supabase's to throttle, not ours. Provider
webhooks and health checks are exempt so legitimate machine traffic — a busy
call centre's Vapi/Twilio callbacks, uptime pings — is never throttled.
"""

from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Paths that must never be throttled. Matched as prefixes after the /v1 mount.
_EXEMPT_PREFIXES = (
    "/v1/webhooks",  # Vapi / Twilio provider callbacks — bursty, machine-driven
    "/v1/health",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
)


class _Store:
    """Fixed-window counters keyed by an arbitrary string.

    Single-threaded async access (one event loop per worker) means no lock is
    needed as long as we never `await` mid-update — and we don't.
    """

    def __init__(self) -> None:
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str, limit: int, window_seconds: float, now: float) -> tuple[bool, int]:
        """Register one hit. Returns (allowed, retry_after_seconds)."""
        start, count = self._windows.get(key, (now, 0))
        if now - start >= window_seconds:
            start, count = now, 0
        count += 1
        self._windows[key] = (start, count)
        if count > limit:
            return False, max(1, int(window_seconds - (now - start)))
        return True, 0

    def purge(self, now: float, max_window: float) -> None:
        """Drop expired windows so memory can't grow without bound."""
        stale = [k for k, (start, _) in self._windows.items() if now - start >= max_window]
        for k in stale:
            del self._windows[k]


def _client_ip(request: Request) -> str:
    """Real client IP behind DigitalOcean's proxy.

    request.client.host is the proxy, so everyone would share one bucket. The
    platform sets X-Forwarded-For; take the left-most (original client) entry.
    Spoofable if the app isn't actually behind a trusted proxy — acceptable for
    an abuse backstop, not for anything security-critical.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _subject(request: Request, ip: str) -> str:
    """Bucket writes per user when we can cheaply read the token subject,
    else fall back to IP. This is only for counting — never a trust decision —
    so the JWT is decoded WITHOUT verification and any failure falls back to IP.
    """
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        parts = token.split(".")
        if len(parts) == 3:
            try:
                import base64
                import json

                pad = parts[1] + "=" * (-len(parts[1]) % 4)
                claims = json.loads(base64.urlsafe_b64decode(pad))
                sub = claims.get("sub")
                if sub:
                    return f"user:{sub}"
            except Exception:
                pass
    return f"ip:{ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._store = _Store()
        self._request_counter = 0

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        if not settings.rate_limit_enabled:
            return await call_next(request)

        path = request.url.path
        if path.startswith(_EXEMPT_PREFIXES):
            return await call_next(request)

        now = time.monotonic()
        ip = _client_ip(request)

        # Opportunistic cleanup — cheap, keeps the dict bounded under churn.
        self._request_counter += 1
        if self._request_counter % 1000 == 0:
            self._store.purge(now, max_window=3600.0)

        # 1) per-IP global, per hour
        allowed, retry = self._store.hit(
            f"g:{ip}", settings.rate_limit_global_per_hour, 3600.0, now
        )
        if not allowed:
            return self._limited(retry, "global", ip)

        # 2) per-user (or per-IP) writes, per minute
        if request.method in _WRITE_METHODS:
            subject = _subject(request, ip)
            allowed, retry = self._store.hit(
                f"w:{subject}", settings.rate_limit_writes_per_minute, 60.0, now
            )
            if not allowed:
                return self._limited(retry, "write", subject)

        return await call_next(request)

    def _limited(self, retry_after: int, scope: str, who: str) -> JSONResponse:
        log.warning("rate_limited", scope=scope, who=who, retry_after=retry_after)
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please slow down and try again shortly.",
                }
            },
            headers={"Retry-After": str(retry_after)},
        )
