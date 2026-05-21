from functools import lru_cache
from typing import Any

import httpx
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.logging import get_logger

# Supabase historically signed JWTs with HS256 + a shared secret.
# Recent CLI/cloud versions sign with asymmetric keys (ES256 or RS256)
# and publish the public keys at /auth/v1/.well-known/jwks.json.
# We accept all three and pick the right verifier per token's `alg`.
ALLOWED_ALGORITHMS = ("HS256", "ES256", "RS256")

log = get_logger(__name__)


@lru_cache(maxsize=1)
def _fetch_jwks() -> dict[str, Any]:
    """Fetch and memoize the JWKS document from Supabase Auth.

    In V1 we cache for the lifetime of the process — Supabase rotates
    rarely and we restart on deploys. If we ever hit token-rotation
    issues, swap this for a TTL cache.
    """
    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        res = httpx.get(url, timeout=5.0)
        res.raise_for_status()
        jwks = res.json()
        log.info("jwks_loaded", url=url, key_count=len(jwks.get("keys", [])))
        return jwks
    except Exception as exc:  # noqa: BLE001
        log.error("jwks_fetch_failed", url=url, error=str(exc))
        return {"keys": []}


def _find_jwk(kid: str | None) -> dict[str, Any] | None:
    jwks = _fetch_jwks()
    keys = jwks.get("keys", []) or []
    if kid:
        for k in keys:
            if k.get("kid") == kid:
                return k
    # Fall back to the first key if no kid was specified
    return keys[0] if keys else None


def decode_supabase_jwt(token: str) -> dict[str, Any]:
    """Verify a Supabase-issued JWT and return its claims.

    Supports HS256 (legacy shared-secret) plus ES256 / RS256 (new asymmetric
    flow with keys served from the JWKS endpoint). We pick the verifier based
    on the token's `alg` header.
    """
    settings = get_settings()

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        log.warning("jwt_header_unreadable", error=str(exc), token_prefix=token[:24])
        raise UnauthorizedError("Token malformed") from exc

    alg = header.get("alg")
    if alg not in ALLOWED_ALGORITHMS:
        log.warning("jwt_unsupported_alg", alg=alg, token_prefix=token[:24])
        raise UnauthorizedError(f"Unsupported JWT algorithm: {alg}")

    if alg == "HS256":
        key: Any = settings.supabase_jwt_secret
    else:
        jwk_dict = _find_jwk(header.get("kid"))
        if not jwk_dict:
            log.error(
                "jwt_no_matching_jwk",
                kid=header.get("kid"),
                jwks_url=f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
            )
            raise UnauthorizedError("Signing key not found")
        key = jwk_dict

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            options={"verify_aud": False},
        )
    except ExpiredSignatureError as exc:
        log.warning("jwt_decode_failed", reason="expired", alg=alg, token_prefix=token[:24])
        raise UnauthorizedError("Token expired") from exc
    except JWTError as exc:
        log.warning(
            "jwt_decode_failed",
            reason=type(exc).__name__,
            alg=alg,
            error=str(exc),
            token_prefix=token[:24],
        )
        raise UnauthorizedError(f"Invalid token: {type(exc).__name__}") from exc
