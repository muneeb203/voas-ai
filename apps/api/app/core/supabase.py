from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase_admin() -> Client:
    """Service-role Supabase client. Bypasses RLS — use ONLY for trusted server ops.

    Application code is still responsible for enforcing workspace scoping; the
    service role is a database superpower, not a license to forget tenancy.
    """
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
