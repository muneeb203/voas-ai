"""Test helpers for forging Supabase-compatible JWTs in tests."""

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import get_settings

TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_USER_EMAIL = "tester@example.com"


def make_token(
    *, user_id: str = TEST_USER_ID, email: str = TEST_USER_EMAIL, is_admin: bool = False
) -> str:
    settings = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "sub": user_id,
        "email": email,
        "iss": "supabase-test",
        "aud": "authenticated",
        "exp": int(exp.timestamp()),
        "app_metadata": {"is_admin": is_admin},
        "user_metadata": {},
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


def auth_header(**kwargs: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(**kwargs)}"}  # type: ignore[arg-type]
