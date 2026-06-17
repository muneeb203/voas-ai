"""Backfill usage_events from existing conversations for the current billing period.

Run from apps/api after migration 00009:
    python -m scripts.backfill_usage

Idempotent — safe to re-run (uses idempotency_key).
"""

from __future__ import annotations

import math

from app.core.supabase import get_supabase_admin
from app.services import billing_service


def _backfill_workspace(workspace_id: str, created_at: str) -> dict[str, int]:
    db = get_supabase_admin()
    period_start, period_end = billing_service.get_period_bounds(created_at)
    start_iso = period_start.isoformat()
    end_iso = period_end.isoformat()
    counts = {"voice": 0, "whatsapp_in": 0, "whatsapp_out": 0}

    convs = (
        db.table("conversations")
        .select("id, channel, location_id, duration_seconds, ended_at")
        .eq("workspace_id", workspace_id)
        .gte("started_at", start_iso)
        .lt("started_at", end_iso)
        .execute()
    )

    for conv in convs.data or []:
        conv_id = conv["id"]
        channel = conv.get("channel")

        if channel == "voice" and conv.get("duration_seconds"):
            minutes = max(1, math.ceil(int(conv["duration_seconds"]) / 60))
            if billing_service.record_usage(
                workspace_id=workspace_id,
                event_type="voice_minutes",
                units=minutes,
                location_id=conv.get("location_id"),
                conversation_id=conv_id,
                idempotency_key=f"voice:{conv_id}",
                metadata={"backfill": True},
            ):
                counts["voice"] += 1

        if channel == "whatsapp":
            msgs = (
                db.table("conversation_messages")
                .select("id, role")
                .eq("conversation_id", conv_id)
                .gte("created_at", start_iso)
                .lt("created_at", end_iso)
                .execute()
            )
            for msg in msgs.data or []:
                role = msg.get("role")
                msg_id = msg["id"]
                if role == "customer":
                    etype = "whatsapp_in"
                    key = f"wa-in:msg:{msg_id}"
                    bucket = "whatsapp_in"
                elif role == "agent":
                    etype = "whatsapp_out"
                    key = f"wa-out:msg:{msg_id}"
                    bucket = "whatsapp_out"
                else:
                    continue
                if billing_service.record_usage(
                    workspace_id=workspace_id,
                    event_type=etype,
                    location_id=conv.get("location_id"),
                    conversation_id=conv_id,
                    idempotency_key=key,
                    metadata={"backfill": True},
                ):
                    counts[bucket] += 1

    return counts


def main() -> None:
    db = get_supabase_admin()
    workspaces = (
        db.table("workspaces").select("id, name, created_at").neq("status", "deleted").execute()
    )
    total = {"voice": 0, "whatsapp_in": 0, "whatsapp_out": 0}
    for ws in workspaces.data or []:
        counts = _backfill_workspace(ws["id"], ws["created_at"])
        print(f"{ws['name']}: {counts}")
        for k, v in counts.items():
            total[k] += v
    print("Done.", total)


if __name__ == "__main__":
    main()
