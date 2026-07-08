"""Mock AI provider server for VOAS load testing (Phase 2.2).

Stands in for Anthropic, OpenAI (TTS), and Deepgram so you can hammer the
FastAPI backend's real code paths (Supabase reads/writes, uvicorn workers,
connection pool) WITHOUT paying the AI providers or hitting their rate limits.

Point the backend at this server for the test run by setting:
    ANTHROPIC_BASE_URL=http://localhost:9000
    OPENAI_BASE_URL=http://localhost:9000/v1
    DEEPGRAM_BASE_URL=http://localhost:9000
    ANTHROPIC_API_KEY=mock            # any non-empty value
    OPENAI_API_KEY=mock               # any non-empty value
    DEEPGRAM_API_KEY=mock             # any non-empty value

Run it (from repo root, using the api venv so fastapi/uvicorn are available):
    apps/api/.venv/Scripts/python.exe loadtest/mock_ai_server.py

Tunable via env:
    MOCK_PORT           default 9000
    MOCK_MESSAGES_MS    added latency on /v1/messages   (default 300)
    MOCK_SPEECH_MS      added latency on /v1/audio/speech (default 150)
    MOCK_TTS_BYTES      bytes returned per TTS call      (default 24000)

The Anthropic mock returns TEXT ONLY (no place_order tool call), so no order
is created and kiosk credits do NOT deplete — the load test can run
indefinitely against a single token.
"""

import asyncio
import os

from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse

app = FastAPI(title="VOAS mock AI providers")

MESSAGES_MS = int(os.getenv("MOCK_MESSAGES_MS", "300"))
SPEECH_MS = int(os.getenv("MOCK_SPEECH_MS", "150"))
TTS_BYTES = int(os.getenv("MOCK_TTS_BYTES", "24000"))


@app.post("/v1/messages")
async def anthropic_messages() -> JSONResponse:
    # Simulate model think-time so requests hold a connection like the real API,
    # which is what actually stresses workers / the sync Supabase client.
    if MESSAGES_MS:
        await asyncio.sleep(MESSAGES_MS / 1000)
    return JSONResponse(
        {
            "id": "msg_mock",
            "type": "message",
            "role": "assistant",
            "model": "claude-haiku-4-5-20251001",
            "content": [{"type": "text", "text": "Got it, anything else?"}],
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 1500,
                "output_tokens": 12,
                "cache_read_input_tokens": 0,
                "cache_creation_input_tokens": 0,
            },
        }
    )


@app.post("/v1/audio/speech")
async def openai_speech() -> Response:
    if SPEECH_MS:
        await asyncio.sleep(SPEECH_MS / 1000)
    return Response(content=b"\x00" * TTS_BYTES, media_type="audio/pcm")


@app.post("/v1/auth/grant")
async def deepgram_grant() -> JSONResponse:
    return JSONResponse({"access_token": "mock-deepgram-jwt", "expires_in": 60})


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("MOCK_PORT", "9000")),
        log_level="warning",
    )
