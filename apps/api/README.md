# @voas/api — FastAPI backend

VOAS AI's backend service. Handles workspace + member management, locations, support tickets, and the admin panel. Voice/WhatsApp/POS integrations land in V2.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate

pip install -e ".[dev]"
cp .env.example .env  # fill in values

uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the live API reference.

## Layout

```
app/
├── main.py            FastAPI entry, middleware, router wiring
├── config.py          Pydantic-settings (env vars)
├── deps.py            Dependency injection (auth, DB, current_user)
├── core/
│   ├── security.py    JWT verification
│   ├── supabase.py    Service-role Supabase client
│   ├── logging.py     Structured logging (structlog)
│   └── exceptions.py  Custom exceptions + handlers
├── routers/           HTTP endpoints (thin)
├── models/            Pydantic request/response models
├── services/          Business logic
└── utils/
```

## Conventions (from CLAUDE.md)

- All endpoints async + typed
- Pydantic models for every request/response — no raw dicts
- Service layer for business logic, routers stay thin
- All endpoints prefixed `/v1/`
- Responses: `{"data": ...}` on success, `{"error": {"code", "message"}}` on error

## Smoke test

```bash
curl http://localhost:8000/v1/health
# → {"data": {"status": "ok", "environment": "development"}}
```
