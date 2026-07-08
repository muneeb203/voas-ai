# VOAS load testing — Phase 2.2 (backend hot paths, AI mocked)

Measures how much pressure the FastAPI backend + Supabase handle **today**, by
driving the real kiosk endpoints under load while the AI providers are mocked —
so you stress *your* infra (workers, sync Supabase client, connection pool)
without paying Anthropic/OpenAI/Deepgram or hitting their rate limits.

## What's here
- `mock_ai_server.py` — stand-in for Anthropic / OpenAI TTS / Deepgram.
- `k6-kiosk.js` — k6 script that runs realistic kiosk turns (chat → speak → metrics) with a ramping VU load to find the breaking point.

## Prerequisites
- **k6** installed (`winget install k6` / `brew install k6` / see grafana.com/k6).
- The API venv (for the mock server): `apps/api/.venv`.
- A **kiosk token** whose workspace has **credits > 0**. Grab one from a kiosk URL you've generated (`/kiosk/<TOKEN>`) or the `kiosk_tokens` table. The mock never places an order, so credits do **not** deplete during the run.

> Run this against **staging**, not production. Ideally the same DO/Supabase tiers as prod so the numbers transfer.

## Step 1 — Start the mock AI server
```bash
apps/api/.venv/Scripts/python.exe loadtest/mock_ai_server.py
# listens on http://localhost:9000
```

## Step 2 — Start the backend pointed at the mock
Set these env vars for the backend process (they override only the base URLs;
prod defaults are unchanged):
```bash
ANTHROPIC_BASE_URL=http://localhost:9000
OPENAI_BASE_URL=http://localhost:9000/v1
DEEPGRAM_BASE_URL=http://localhost:9000
ANTHROPIC_API_KEY=mock
OPENAI_API_KEY=mock
DEEPGRAM_API_KEY=mock
```
Then run the API the way you normally do (note the worker count — it's a key
variable you're testing):
```bash
# example
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Step 3 — Run the load test
```bash
k6 run -e BASE_URL=http://localhost:8000 -e TOKEN=<kiosk_token> loadtest/k6-kiosk.js
```
Tune the ramp without editing the file:
```bash
k6 run -e BASE_URL=... -e TOKEN=... -e MAX_VUS=300 -e STAGE=90s loadtest/k6-kiosk.js
```

## How to read the result — this is the point
Find the **knee**: the VU level where `http_req_duration` p95 crosses your SLO
and `http_req_failed` / `voas_turn_errors` start climbing. That VU count (and
its requests/sec) is your **current capacity**. Per-endpoint latency is tagged
`name=chat|speak|metrics`.

While it runs, watch **saturation** to identify the bottleneck:
- **DigitalOcean** app metrics — CPU / memory (is the box maxed?).
- **Supabase** dashboard — active DB connections (pool exhaustion?) and slow queries.
- **Sentry** — error spikes.

### The specific thing to look for
The Supabase Python client is **synchronous**. Under concurrency those blocking
calls can stall the async event loop and **serialize** requests. Signature:
throughput (req/s) **flatlines** while latency climbs linearly even though
CPU/DB are **not** maxed. If you see that, the fix is running more uvicorn
workers and/or moving the sync DB calls off the event loop — re-run after each
change to confirm the ceiling moved.

## Vary these to map capacity
- `--workers N` on uvicorn — the biggest lever for the sync-client issue.
- `MAX_VUS` / `STAGE` on k6 — how hard and how fast you push.
- `MOCK_MESSAGES_MS` on the mock — simulates model think-time; higher values
  hold connections longer and surface worker saturation sooner.

## Scope / caveats
- This is **infra capacity with AI mocked**. Real provider **rate limits** are a
  separate ceiling — measure those later with a small, budget-capped real run
  (Phase 4).
- Static/frontend and authed dashboard endpoints aren't covered here; this
  targets the kiosk hot paths, which are the highest-volume public surface.
