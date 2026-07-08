// VOAS backend load test — Phase 2.2 (hot paths, AI providers mocked).
//
// Drives one realistic kiosk "turn" per iteration against the FastAPI backend:
//   chat -> speak -> metrics  (+ occasional info fetch)
// so you stress the real infra (Supabase reads/writes, uvicorn workers,
// connection pool) while the AI calls hit the mock server, not the real APIs.
//
// Prereqs:
//   1. Mock AI server running (loadtest/mock_ai_server.py) and the backend
//      pointed at it via ANTHROPIC_BASE_URL / OPENAI_BASE_URL / DEEPGRAM_BASE_URL.
//   2. A valid kiosk TOKEN whose workspace has kiosk credits > 0. Because the
//      mock never places an order, credits do not deplete during the run.
//
// Run (finds the "knee" by ramping VUs):
//   k6 run -e BASE_URL=http://localhost:8000 -e TOKEN=<kiosk_token> loadtest/k6-kiosk.js
//
// Tune the ramp without editing the file:
//   -e MAX_VUS=300 -e STAGE=90s
//
// Read the result: watch the VU level where p95 latency crosses your SLO and
// http_req_failed starts climbing — that's your current capacity. Per-endpoint
// latency is tagged (name=chat|speak|metrics|info).

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
const TOKEN = __ENV.TOKEN;
const MAX_VUS = parseInt(__ENV.MAX_VUS || '200', 10);
const STAGE = __ENV.STAGE || '60s';

const chatTrend = new Trend('voas_chat_ms', true);
const speakTrend = new Trend('voas_speak_ms', true);
const metricsTrend = new Trend('voas_metrics_ms', true);
const turnErrors = new Rate('voas_turn_errors');

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      // Step up so you can see exactly where latency/errors break.
      stages: [
        { duration: STAGE, target: Math.round(MAX_VUS * 0.1) },
        { duration: STAGE, target: Math.round(MAX_VUS * 0.25) },
        { duration: STAGE, target: Math.round(MAX_VUS * 0.5) },
        { duration: STAGE, target: MAX_VUS },
        { duration: STAGE, target: MAX_VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulStop: '15s',
    },
  },
  thresholds: {
    // Adjust these to your SLOs; a breach flags where capacity ends.
    http_req_failed: ['rate<0.02'],
    'http_req_duration{name:chat}': ['p(95)<1500'],
    'http_req_duration{name:metrics}': ['p(95)<400'],
    voas_turn_errors: ['rate<0.02'],
  },
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export function setup() {
  if (!TOKEN) {
    throw new Error('Set -e TOKEN=<kiosk_token> (a token whose workspace has credits > 0).');
  }
  // Fail fast if the token/endpoint is wrong before generating load.
  const res = http.get(`${BASE_URL}/v1/kiosk/${TOKEN}`);
  check(res, { 'kiosk token valid (info 200)': (r) => r.status === 200 });
  return {};
}

export default function () {
  let ok = true;

  group('turn', () => {
    // 1) chat — Supabase balance read + (mocked) Anthropic call
    const chatRes = http.post(
      `${BASE_URL}/v1/kiosk/${TOKEN}/chat`,
      JSON.stringify({ messages: [{ role: 'user', content: 'can I get a burger and a coke' }] }),
      { ...JSON_HEADERS, tags: { name: 'chat' } },
    );
    chatTrend.add(chatRes.timings.duration);
    const chatOk = check(chatRes, { 'chat 200': (r) => r.status === 200 });
    ok = ok && chatOk;

    // 2) speak — proxies (mocked) OpenAI TTS as a stream
    const speakRes = http.post(
      `${BASE_URL}/v1/kiosk/${TOKEN}/speak`,
      JSON.stringify({ text: 'Got it, anything else?', format: 'pcm' }),
      { ...JSON_HEADERS, tags: { name: 'speak' } },
    );
    speakTrend.add(speakRes.timings.duration);
    ok = ok && check(speakRes, { 'speak 200': (r) => r.status === 200 });

    // 3) metrics — Supabase INSERT (write-path load)
    const metricsRes = http.post(
      `${BASE_URL}/v1/kiosk/${TOKEN}/metrics`,
      JSON.stringify({
        stt_source: 'deepgram',
        stt_confidence: 0.95,
        chat_ms: 800,
        anthropic_ms: 700,
        tts_ms: 1000,
        order_placed: false,
      }),
      { ...JSON_HEADERS, tags: { name: 'metrics' } },
    );
    metricsTrend.add(metricsRes.timings.duration);
    ok = ok && check(metricsRes, { 'metrics 200': (r) => r.status === 200 });
  });

  turnErrors.add(!ok);
  // Small think-time between turns so VUs model users, not a tight loop.
  sleep(Math.random() * 2 + 1);
}
