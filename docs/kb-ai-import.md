# AI Menu Import — Implementation Plan

> Status: **Coming Soon** — UI placeholder is live. Blocked on `ANTHROPIC_API_KEY` being added to the backend environment. Once added, remove the coming-soon dialog and wire up the endpoint.

---

## What It Does

Restaurant owners paste any block of text (e.g. a ChatGPT/Claude output describing their full menu) into a textarea. The backend calls Claude, extracts the full menu hierarchy, and inserts everything into the DB automatically. Imported items are added on top of existing menu — nothing is replaced.

---

## Full DB Hierarchy to Extract

```
menu_categories
  └── menu_items
        └── menu_modifier_groups
              └── menu_modifier_options
```

- Knowledge base is **per-workspace** (shared across all locations)
- Import **appends** — never replaces existing data

---

## Backend

### New endpoint
`POST /v1/workspaces/{workspace_id}/menu/import`

**Request:**
```json
{ "text": "<full pasted menu text>" }
```

**Response:**
```json
{
  "data": {
    "categories_created": 5,
    "items_created": 24,
    "modifier_groups_created": 12,
    "modifier_options_created": 38
  }
}
```

### Claude extraction prompt (in `menu_service.py`)

```python
IMPORT_PROMPT = """
You are a data extraction assistant. Extract a structured restaurant menu from the text below.

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
          "price_cents": integer (convert price to cents, e.g. $12.99 → 1299),
          "modifier_groups": [
            {
              "name": "string",
              "min_select": integer,
              "max_select": integer,
              "required": boolean,
              "options": [
                {
                  "name": "string",
                  "price_delta_cents": integer (0 if no price difference),
                  "is_default": boolean
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- If no modifier groups exist for an item, set modifier_groups to []
- Convert all prices to integer cents (multiply dollars by 100)
- If a price is missing or unclear, set price_cents to 0
- Group items logically even if the source text has no explicit categories

Menu text:
{text}
"""
```

### Insert order (sequential — each level needs parent ID)

```python
async def import_from_text(workspace_id: str, text: str) -> dict:
    db = get_supabase_admin()

    # 1. Call Claude
    response = anthropic.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": IMPORT_PROMPT.format(text=text)}]
    )
    parsed = json.loads(response.content[0].text)

    # 2. Get max existing sort_order for categories
    existing = db.table("menu_categories").select("sort_order") \
        .eq("workspace_id", workspace_id).order("sort_order", desc=True).limit(1).execute()
    cat_sort = (existing.data[0]["sort_order"] + 1) if existing.data else 0

    counts = {"categories_created": 0, "items_created": 0,
              "modifier_groups_created": 0, "modifier_options_created": 0}

    for cat_data in parsed.get("categories", []):
        # 3. Insert category
        cat_res = db.table("menu_categories").insert({
            "workspace_id": workspace_id,
            "name": cat_data["name"],
            "description": cat_data.get("description"),
            "sort_order": cat_sort,
        }).execute()
        cat_sort += 1
        category_id = cat_res.data[0]["id"]
        counts["categories_created"] += 1

        for item_sort, item_data in enumerate(cat_data.get("items", [])):
            # 4. Insert item
            item_res = db.table("menu_items").insert({
                "workspace_id": workspace_id,
                "category_id": category_id,
                "name": item_data["name"],
                "description": item_data.get("description"),
                "price_cents": item_data.get("price_cents", 0),
                "sort_order": item_sort,
            }).execute()
            item_id = item_res.data[0]["id"]
            counts["items_created"] += 1

            for grp_sort, grp_data in enumerate(item_data.get("modifier_groups", [])):
                # 5. Insert modifier group
                grp_res = db.table("menu_modifier_groups").insert({
                    "item_id": item_id,
                    "name": grp_data["name"],
                    "min_select": grp_data.get("min_select", 0),
                    "max_select": grp_data.get("max_select", 1),
                    "required": grp_data.get("required", False),
                    "sort_order": grp_sort,
                }).execute()
                group_id = grp_res.data[0]["id"]
                counts["modifier_groups_created"] += 1

                for opt_sort, opt_data in enumerate(grp_data.get("options", [])):
                    # 6. Insert modifier option
                    db.table("menu_modifier_options").insert({
                        "group_id": group_id,
                        "name": opt_data["name"],
                        "price_delta_cents": opt_data.get("price_delta_cents", 0),
                        "is_default": opt_data.get("is_default", False),
                        "sort_order": opt_sort,
                    }).execute()
                    counts["modifier_options_created"] += 1

    return counts
```

### Files to create/modify

| File | Change |
|---|---|
| `apps/api/app/routers/menu.py` | Add `POST /import` route |
| `apps/api/app/services/menu_service.py` | Add `import_from_text()` |
| `apps/api/app/config.py` | Ensure `ANTHROPIC_API_KEY` is in settings |

**Dependencies to add to `pyproject.toml`:**
```toml
anthropic = "^0.40.0"
```

---

## Frontend

### Files to create/modify

| File | Change |
|---|---|
| `apps/web/lib/api/menu.ts` | Add `importMenu(workspaceId, text)` |
| `apps/web/app/actions/menu-action.ts` | Add `importMenuAction` |
| `apps/web/components/dashboard/menu-editor.tsx` | Replace coming-soon dialog with real `ImportDialog` |

### Replace `ImportComingSoonDialog` with this real implementation

```tsx
function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);

  async function handleImport() {
    if (!text.trim()) return;
    setPending(true);
    const res = await importMenuAction(text);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        `Imported ${res.data.categories_created} categories, ${res.data.items_created} items`
      );
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Import menu from text
          </DialogTitle>
          <DialogDescription>
            Paste any menu text — ChatGPT output, a copied menu, anything.
            AI will extract categories, items, prices, and modifiers automatically.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Paste your menu text here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          disabled={pending}
          className="font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={pending || !text.trim()}>
            {pending ? 'Importing…' : 'Import menu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### `importMenuAction` in `menu-action.ts`

```typescript
export async function importMenuAction(text: string) {
  const session = await requireDashboardSession('/knowledge-base');
  const res = await importMenu(session.active.workspace_id, text);
  if (isApiError(res)) return { error: res.error.message, data: null };
  return { error: null, data: res.data };
}
```

### `importMenu` in `menu.ts`

```typescript
export function importMenu(workspaceId: string, text: string) {
  return apiCall<{
    categories_created: number;
    items_created: number;
    modifier_groups_created: number;
    modifier_options_created: number;
  }>(`/v1/workspaces/${workspaceId}/menu/import`, {
    method: 'POST',
    body: { text },
  });
}
```

---

## To Activate (when ANTHROPIC_API_KEY is ready)

1. Add `ANTHROPIC_API_KEY` to backend env vars (DO App Platform → jellyfish-app → Settings → Environment Variables)
2. Add `anthropic` package: `cd apps/api && uv add anthropic`
3. Build backend endpoint + service (see above)
4. Build frontend `importMenu` + `importMenuAction`
5. Replace `ImportComingSoonDialog` in `menu-editor.tsx` with the real `ImportDialog`
6. Deploy both apps

---

## Cost Estimate

Model: `claude-haiku-4-5-20251001` (cheapest, sufficient for extraction)

| Menu size | Approx tokens | Approx cost |
|---|---|---|
| 20 items | ~1,500 in + 1,000 out | ~$0.0005 |
| 50 items | ~2,500 in + 2,000 out | ~$0.001 |
| 100 items | ~4,000 in + 3,500 out | ~$0.002 |

Even 1,000 imports/month ≈ $1–2 total.
