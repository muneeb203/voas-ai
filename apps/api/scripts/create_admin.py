"""Provision a VOAS admin user.

Usage (from apps/api with the venv activated):

    python -m scripts.create_admin --email you@convosol.com --name "Your Name" --password 'somepassword'
    python -m scripts.create_admin --email you@convosol.com --name "Your Name" --super-admin

Re-running with the same email upserts: it'll find the existing auth user,
set is_admin=true, and ensure the admin_users row exists/active.
"""

from __future__ import annotations

import argparse
import secrets
import sys
from typing import Any

from app.core.supabase import get_supabase_admin


def _find_user_by_email(db: Any, email: str) -> dict[str, Any] | None:
    """Supabase admin API: list users, find by email."""
    page = 1
    while True:
        res = db.auth.admin.list_users(page=page, per_page=200)
        users = getattr(res, "users", None) or res or []
        if not users:
            return None
        for u in users:
            user_email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
            if user_email and user_email.lower() == email.lower():
                return u if isinstance(u, dict) else {
                    "id": u.id,
                    "email": u.email,
                    "user_metadata": u.user_metadata or {},
                    "app_metadata": u.app_metadata or {},
                }
        if len(users) < 200:
            return None
        page += 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or upgrade a VOAS admin user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="Full name to display in the admin UI")
    parser.add_argument(
        "--password",
        default=None,
        help="Password to set. If omitted on new users, a random 32-char password is generated and printed once.",
    )
    parser.add_argument(
        "--super-admin",
        action="store_true",
        help="Grant super_admin role (otherwise admin).",
    )
    args = parser.parse_args()

    role = "super_admin" if args.super_admin else "admin"
    db = get_supabase_admin()

    existing = _find_user_by_email(db, args.email)

    if existing:
        user_id: str = existing["id"]
        meta_update: dict[str, Any] = {"app_metadata": {"is_admin": True}}
        if args.password:
            meta_update["password"] = args.password
        db.auth.admin.update_user_by_id(user_id, meta_update)
        print(f"✓ Updated existing user {args.email} → is_admin=true")
    else:
        password = args.password or secrets.token_urlsafe(24)
        created = db.auth.admin.create_user(
            {
                "email": args.email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": args.name},
                "app_metadata": {"is_admin": True},
            }
        )
        user = getattr(created, "user", None)
        if not user:
            print("✗ Failed to create user", file=sys.stderr)
            return 1
        user_id = user.id
        print(f"✓ Created auth user {args.email}")
        if not args.password:
            print(f"  Generated password (save this now): {password}")

    # Upsert into admin_users.
    existing_admin = (
        db.table("admin_users").select("id").eq("user_id", user_id).limit(1).execute()
    )
    if existing_admin.data:
        db.table("admin_users").update(
            {"full_name": args.name, "role": role, "is_active": True}
        ).eq("user_id", user_id).execute()
        print(f"✓ Updated admin_users row (role={role}, active=true)")
    else:
        db.table("admin_users").insert(
            {"user_id": user_id, "full_name": args.name, "role": role, "is_active": True}
        ).execute()
        print(f"✓ Inserted admin_users row (role={role})")

    print(f"\nAll set. Sign in at /admin/login as {args.email}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
