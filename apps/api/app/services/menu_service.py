import json

import httpx

from app.config import get_settings
from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.menu import (
    MenuCategory,
    MenuCategoryCreate,
    MenuCategoryUpdate,
    MenuItem,
    MenuItemCreate,
    MenuItemUpdate,
    MenuModifierGroup,
    MenuModifierGroupCreate,
    MenuModifierGroupUpdate,
    MenuModifierOption,
    MenuModifierOptionCreate,
    MenuModifierOptionUpdate,
)
from app.services import audit_service

# --- Categories -------------------------------------------------------------


def list_categories(workspace_id: str) -> list[MenuCategory]:
    db = get_supabase_admin()
    cat_res = (
        db.table("menu_categories")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("sort_order", desc=False)
        .execute()
    )
    cats = cat_res.data or []
    if not cats:
        return []

    items = db.table("menu_items").select("category_id").eq("workspace_id", workspace_id).execute()
    counts: dict[str, int] = {}
    for row in items.data or []:
        counts[row["category_id"]] = counts.get(row["category_id"], 0) + 1

    return [MenuCategory(**{**c, "item_count": counts.get(c["id"], 0)}) for c in cats]


def create_category(workspace_id: str, payload: MenuCategoryCreate, actor_id: str) -> MenuCategory:
    db = get_supabase_admin()
    res = (
        db.table("menu_categories")
        .insert({**payload.model_dump(), "workspace_id": workspace_id})
        .execute()
    )
    if not res.data:
        raise AppError("Could not create category")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.category.created",
        resource_type="menu_category",
        resource_id=res.data[0]["id"],
        metadata={"name": payload.name},
    )
    return MenuCategory(**{**res.data[0], "item_count": 0})


def update_category(
    workspace_id: str, category_id: str, payload: MenuCategoryUpdate, actor_id: str
) -> MenuCategory:
    db = get_supabase_admin()
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        existing = (
            db.table("menu_categories")
            .select("*")
            .eq("id", category_id)
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise NotFoundError("Category not found")
        return MenuCategory(**{**existing.data[0], "item_count": 0})

    res = (
        db.table("menu_categories")
        .update(changes)
        .eq("id", category_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Category not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.category.updated",
        resource_type="menu_category",
        resource_id=category_id,
        metadata={"changed_fields": list(changes.keys())},
    )
    return MenuCategory(**{**res.data[0], "item_count": 0})


def delete_category(workspace_id: str, category_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("menu_categories")
        .delete()
        .eq("id", category_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Category not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.category.deleted",
        resource_type="menu_category",
        resource_id=category_id,
    )


# --- Items ------------------------------------------------------------------


def _hydrate_item(row: dict, modifier_groups: list[MenuModifierGroup]) -> MenuItem:
    return MenuItem(**{**row, "modifier_groups": modifier_groups})


def list_items(workspace_id: str, *, category_id: str | None = None) -> list[MenuItem]:
    db = get_supabase_admin()
    query = (
        db.table("menu_items")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("sort_order", desc=False)
    )
    if category_id:
        query = query.eq("category_id", category_id)
    items_res = query.execute()
    items = items_res.data or []
    if not items:
        return []

    item_ids = [i["id"] for i in items]
    groups_res = (
        db.table("menu_modifier_groups")
        .select("*")
        .in_("item_id", item_ids)
        .order("sort_order", desc=False)
        .execute()
    )
    groups = groups_res.data or []
    group_by_item: dict[str, list[dict]] = {}
    for g in groups:
        group_by_item.setdefault(g["item_id"], []).append(g)

    options_by_group: dict[str, list[dict]] = {}
    if groups:
        # Only query options when there's at least one group, otherwise the
        # IN clause receives an empty list and we'd previously pass ["none"]
        # which Postgres can't cast to uuid — that crashed the whole query.
        options_res = (
            db.table("menu_modifier_options")
            .select("*")
            .in_("group_id", [g["id"] for g in groups])
            .order("sort_order", desc=False)
            .execute()
        )
        for o in options_res.data or []:
            options_by_group.setdefault(o["group_id"], []).append(o)

    return [
        _hydrate_item(
            item,
            [
                MenuModifierGroup(
                    **{
                        **g,
                        "options": [
                            MenuModifierOption.model_validate(o)
                            for o in options_by_group.get(g["id"], [])
                        ],
                    }
                )
                for g in group_by_item.get(item["id"], [])
            ],
        )
        for item in items
    ]


def get_item(workspace_id: str, item_id: str) -> MenuItem:
    items = [i for i in list_items(workspace_id) if i.id == item_id]
    if not items:
        raise NotFoundError("Item not found")
    return items[0]


def create_item(workspace_id: str, payload: MenuItemCreate, actor_id: str) -> MenuItem:
    db = get_supabase_admin()
    res = (
        db.table("menu_items")
        .insert({**payload.model_dump(), "workspace_id": workspace_id})
        .execute()
    )
    if not res.data:
        raise AppError("Could not create item")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.item.created",
        resource_type="menu_item",
        resource_id=res.data[0]["id"],
        metadata={"name": payload.name},
    )
    return _hydrate_item(res.data[0], [])


def update_item(
    workspace_id: str, item_id: str, payload: MenuItemUpdate, actor_id: str
) -> MenuItem:
    db = get_supabase_admin()
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        return get_item(workspace_id, item_id)

    res = (
        db.table("menu_items")
        .update(changes)
        .eq("id", item_id)
        .eq("workspace_id", workspace_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Item not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.item.updated",
        resource_type="menu_item",
        resource_id=item_id,
        metadata={"changed_fields": list(changes.keys())},
    )
    return get_item(workspace_id, item_id)


def delete_item(workspace_id: str, item_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("menu_items").delete().eq("id", item_id).eq("workspace_id", workspace_id).execute()
    )
    if not res.data:
        raise NotFoundError("Item not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.item.deleted",
        resource_type="menu_item",
        resource_id=item_id,
    )


# --- Modifier groups & options ----------------------------------------------


def _verify_item_owned(workspace_id: str, item_id: str) -> None:
    db = get_supabase_admin()
    res = (
        db.table("menu_items")
        .select("id")
        .eq("id", item_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Item not found")


def _verify_group_owned(workspace_id: str, group_id: str) -> str:
    """Return the item_id if the group belongs to a workspace item."""
    db = get_supabase_admin()
    res = (
        db.table("menu_modifier_groups")
        .select("id, item_id, menu_items(workspace_id)")
        .eq("id", group_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Modifier group not found")
    row = res.data[0]
    parent = row.get("menu_items") or {}
    if parent.get("workspace_id") != workspace_id:
        raise NotFoundError("Modifier group not found")
    return row["item_id"]


def create_modifier_group(
    workspace_id: str, item_id: str, payload: MenuModifierGroupCreate, actor_id: str
) -> MenuModifierGroup:
    _verify_item_owned(workspace_id, item_id)
    db = get_supabase_admin()
    res = (
        db.table("menu_modifier_groups")
        .insert({**payload.model_dump(), "item_id": item_id})
        .execute()
    )
    if not res.data:
        raise AppError("Could not create modifier group")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_group.created",
        resource_type="menu_modifier_group",
        resource_id=res.data[0]["id"],
        metadata={"item_id": item_id, "name": payload.name},
    )
    return MenuModifierGroup(**{**res.data[0], "options": []})


def update_modifier_group(
    workspace_id: str, group_id: str, payload: MenuModifierGroupUpdate, actor_id: str
) -> MenuModifierGroup:
    _verify_group_owned(workspace_id, group_id)
    db = get_supabase_admin()
    changes = payload.model_dump(exclude_none=True)
    res = db.table("menu_modifier_groups").update(changes).eq("id", group_id).execute()
    if not res.data:
        raise NotFoundError("Modifier group not found")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_group.updated",
        resource_type="menu_modifier_group",
        resource_id=group_id,
    )
    options_res = (
        db.table("menu_modifier_options")
        .select("*")
        .eq("group_id", group_id)
        .order("sort_order", desc=False)
        .execute()
    )
    return MenuModifierGroup(
        **{
            **res.data[0],
            "options": [MenuModifierOption.model_validate(o) for o in options_res.data or []],
        }
    )


def delete_modifier_group(workspace_id: str, group_id: str, actor_id: str) -> None:
    _verify_group_owned(workspace_id, group_id)
    db = get_supabase_admin()
    db.table("menu_modifier_groups").delete().eq("id", group_id).execute()
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_group.deleted",
        resource_type="menu_modifier_group",
        resource_id=group_id,
    )


def create_modifier_option(
    workspace_id: str, group_id: str, payload: MenuModifierOptionCreate, actor_id: str
) -> MenuModifierOption:
    _verify_group_owned(workspace_id, group_id)
    db = get_supabase_admin()
    res = (
        db.table("menu_modifier_options")
        .insert({**payload.model_dump(), "group_id": group_id})
        .execute()
    )
    if not res.data:
        raise AppError("Could not create modifier option")
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_option.created",
        resource_type="menu_modifier_option",
        resource_id=res.data[0]["id"],
    )
    return MenuModifierOption.model_validate(res.data[0])


def update_modifier_option(
    workspace_id: str, option_id: str, payload: MenuModifierOptionUpdate, actor_id: str
) -> MenuModifierOption:
    db = get_supabase_admin()
    existing = (
        db.table("menu_modifier_options").select("group_id").eq("id", option_id).limit(1).execute()
    )
    if not existing.data:
        raise NotFoundError("Modifier option not found")
    _verify_group_owned(workspace_id, existing.data[0]["group_id"])

    changes = payload.model_dump(exclude_none=True)
    res = db.table("menu_modifier_options").update(changes).eq("id", option_id).execute()
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_option.updated",
        resource_type="menu_modifier_option",
        resource_id=option_id,
    )
    return MenuModifierOption.model_validate(res.data[0])


def delete_modifier_option(workspace_id: str, option_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    existing = (
        db.table("menu_modifier_options").select("group_id").eq("id", option_id).limit(1).execute()
    )
    if not existing.data:
        raise NotFoundError("Modifier option not found")
    _verify_group_owned(workspace_id, existing.data[0]["group_id"])

    db.table("menu_modifier_options").delete().eq("id", option_id).execute()
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.modifier_option.deleted",
        resource_type="menu_modifier_option",
        resource_id=option_id,
    )


# --- AI import from text -----------------------------------------------------

_IMPORT_MODEL = "claude-haiku-4-5-20251001"

# Text is appended (not .format-ed) so the JSON braces below need no escaping.
_IMPORT_PROMPT = """You are a data extraction assistant. Extract a structured \
restaurant menu from the text below.

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "categories": [
    {
      "name": "string",
      "description": "string or null",
      "items": [
        {
          "name": "string",
          "description": "string or null",
          "price_cents": 0,
          "modifier_groups": [
            {
              "name": "string",
              "min_select": 0,
              "max_select": 1,
              "required": false,
              "options": [
                { "name": "string", "price_delta_cents": 0, "is_default": false }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Convert all prices to integer cents (e.g. $12.99 -> 1299). If unclear, use 0.
- If an item has no modifiers, set modifier_groups to [].
- Group items into sensible categories even if the source text has none.

Menu text:
"""


def _extract_menu_json(raw: str) -> dict:
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise AppError("Couldn't read a menu from that text — add clearer item names and prices.")
    try:
        return json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AppError("Couldn't parse a menu from that text — try simplifying it.") from exc


def import_from_text(workspace_id: str, text: str, actor_id: str) -> dict:
    """Extract a menu from free text via Claude and append it to the workspace
    menu (categories -> items -> modifier groups -> options). Never replaces
    existing menu data."""
    cfg = get_settings()
    if not cfg.anthropic_api_key:
        raise AppError("AI import isn't configured — add ANTHROPIC_API_KEY to the backend.")

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": cfg.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": _IMPORT_MODEL,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": _IMPORT_PROMPT + text}],
            },
        )
    if resp.status_code != 200:
        raise AppError(f"AI import failed ({resp.status_code}). Please try again.")

    blocks = resp.json().get("content", [])
    raw = next((b["text"] for b in blocks if b.get("type") == "text"), "")
    parsed = _extract_menu_json(raw)

    db = get_supabase_admin()
    existing = (
        db.table("menu_categories")
        .select("sort_order")
        .eq("workspace_id", workspace_id)
        .order("sort_order", desc=True)
        .limit(1)
        .execute()
    )
    cat_sort = (existing.data[0]["sort_order"] + 1) if existing.data else 0

    counts = {
        "categories_created": 0,
        "items_created": 0,
        "modifier_groups_created": 0,
        "modifier_options_created": 0,
    }

    for cat in parsed.get("categories", []):
        cat_name = str(cat.get("name") or "").strip()
        if not cat_name:
            continue
        cat_res = (
            db.table("menu_categories")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "name": cat_name,
                    "description": cat.get("description") or None,
                    "sort_order": cat_sort,
                }
            )
            .execute()
        )
        cat_sort += 1
        if not cat_res.data:
            continue
        category_id = cat_res.data[0]["id"]
        counts["categories_created"] += 1

        for item_sort, item in enumerate(cat.get("items", [])):
            item_name = str(item.get("name") or "").strip()
            if not item_name:
                continue
            item_res = (
                db.table("menu_items")
                .insert(
                    {
                        "workspace_id": workspace_id,
                        "category_id": category_id,
                        "name": item_name,
                        "description": item.get("description") or None,
                        "price_cents": int(item.get("price_cents") or 0),
                        "sort_order": item_sort,
                    }
                )
                .execute()
            )
            if not item_res.data:
                continue
            item_id = item_res.data[0]["id"]
            counts["items_created"] += 1

            for grp_sort, grp in enumerate(item.get("modifier_groups", [])):
                grp_name = str(grp.get("name") or "").strip()
                if not grp_name:
                    continue
                grp_res = (
                    db.table("menu_modifier_groups")
                    .insert(
                        {
                            "item_id": item_id,
                            "name": grp_name,
                            "min_select": int(grp.get("min_select") or 0),
                            "max_select": int(grp.get("max_select") or 1),
                            "required": bool(grp.get("required") or False),
                            "sort_order": grp_sort,
                        }
                    )
                    .execute()
                )
                if not grp_res.data:
                    continue
                group_id = grp_res.data[0]["id"]
                counts["modifier_groups_created"] += 1

                for opt_sort, opt in enumerate(grp.get("options", [])):
                    opt_name = str(opt.get("name") or "").strip()
                    if not opt_name:
                        continue
                    db.table("menu_modifier_options").insert(
                        {
                            "group_id": group_id,
                            "name": opt_name,
                            "price_delta_cents": int(opt.get("price_delta_cents") or 0),
                            "is_default": bool(opt.get("is_default") or False),
                            "sort_order": opt_sort,
                        }
                    ).execute()
                    counts["modifier_options_created"] += 1

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="menu.imported",
        resource_type="menu",
        metadata=counts,
    )
    return counts
