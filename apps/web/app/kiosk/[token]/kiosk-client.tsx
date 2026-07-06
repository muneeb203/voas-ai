'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, PhoneOff } from 'lucide-react';
import {
  claimKioskSession,
  heartbeatKioskSession,
  kioskChat,
  kioskSpeak,
  type KioskChatMessage,
} from '@/lib/api/kiosk-public';

interface SpeechRecognitionResultLike extends ArrayLike<{ transcript: string }> {
  readonly isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

interface SttTokenData {
  access_token: string;
  expires_in: number;
  model: string;
  endpointing_ms: number;
  keywords: string[];
}

interface DeepgramResult {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: { alternatives?: { transcript?: string }[] };
}

interface KioskClientProps {
  token: string;
  locationName: string;
  workspaceName: string;
  theme: 'warm' | 'light' | 'gradient';
  sessionLockEnabled: boolean;
}

type KioskState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'speaking'
  | 'confirmed'
  | 'error'
  | 'locked'
  | 'stolen'
  | 'unavailable';

interface OrderItem {
  name: string;
  qty: number;
  price?: string;
}

const SOUND_BAR_HEIGHTS = [30, 55, 80, 100, 80, 55, 30, 55, 80, 55];
const HEARTBEAT_INTERVAL_MS = 25_000;
const STT_SILENCE_MS = 900; // finalize the transcript after this much silence
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const TTS_SAMPLE_RATE = 24000; // OpenAI tts-1 pcm: 24kHz, 16-bit signed LE, mono

// Rate a provider's response time for the ?debug overlay: green/amber/red.
function rateMs(
  ms: number | null,
  goodMax: number,
  okMax: number,
): { label: string; cls: string } {
  if (ms == null) return { label: '—', cls: 'text-white/50' };
  if (ms <= goodMax) return { label: 'good', cls: 'text-emerald-300' };
  if (ms <= okMax) return { label: 'ok', cls: 'text-amber-300' };
  return { label: 'slow', cls: 'text-red-300' };
}

// ── Theme config ───────────────────────────────────────────────────────────────

type ThemeCfg = {
  wrapperStyle: React.CSSProperties;
  wrapperClass: string;
  accentColor: string;
  buttonClass: string;
  buttonShadow: string;
  soundBarClass: string;
  badgeClass: string;
  textPrimary: string;
  textSecondary: string;
};

const THEME_CFG: Record<string, ThemeCfg> = {
  warm: {
    wrapperStyle: { background: 'linear-gradient(160deg, #1a1208 0%, #2d1f0e 50%, #1a1208 100%)' },
    wrapperClass: '',
    accentColor: '#f59e0b',
    buttonClass: 'bg-amber-500 hover:bg-amber-400',
    buttonShadow: 'shadow-amber-500/40',
    soundBarClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    textPrimary: 'text-white',
    textSecondary: 'text-white/50',
  },
  light: {
    wrapperStyle: {},
    wrapperClass: 'bg-[#fafaf8]',
    accentColor: '#00C2A8',
    buttonClass: 'bg-[#00C2A8] hover:bg-[#00aD98]',
    buttonShadow: 'shadow-[#00C2A8]/30',
    soundBarClass: 'bg-[#00C2A8]',
    badgeClass: 'bg-[#00C2A8]/10 text-[#00C2A8] border border-[#00C2A8]/30',
    textPrimary: 'text-[#0A2540]',
    textSecondary: 'text-slate-500',
  },
  gradient: {
    wrapperStyle: { background: 'linear-gradient(145deg, #0A2540 0%, #0d3260 40%, #0a4a4a 100%)' },
    wrapperClass: '',
    accentColor: '#00C2A8',
    buttonClass: 'bg-[#00C2A8] hover:bg-[#00aD98]',
    buttonShadow: 'shadow-[#00C2A8]/50',
    soundBarClass: 'bg-[#00C2A8]',
    badgeClass: 'bg-[#00C2A8]/15 text-[#00C2A8] border border-[#00C2A8]/30',
    textPrimary: 'text-white',
    textSecondary: 'text-white/50',
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function KioskClient({
  token,
  locationName,
  workspaceName,
  theme,
  sessionLockEnabled,
}: KioskClientProps) {
  const cfg = (THEME_CFG[theme] ?? THEME_CFG['gradient']) as ThemeCfg;

  const [kioskState, setKioskState] = useState<KioskState>('idle');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [dbg, setDbg] = useState<{
    stt: number;
    chat: number;
    anthropicMs: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
    tts: number | null;
    sttSource: 'deepgram' | 'browser' | null;
    ttsSource: 'openai' | 'openai-mp3' | 'browser' | null;
  } | null>(null);

  // Refs — stable across renders, safe to read/write inside async loops
  const kioskStateRef = useRef<KioskState>('idle');
  const sessionIdRef = useRef<string>('');
  const messagesRef = useRef<KioskChatMessage[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const streamSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const audioAbortRef = useRef<AbortController | null>(null);
  const debugRef = useRef(false);
  const ttsFirstAudioRef = useRef<number | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deepgram streaming STT (falls back to the browser recogniser on any failure)
  const dgCtxRef = useRef<AudioContext | null>(null);
  const dgStreamRef = useRef<MediaStream | null>(null);
  const dgWsRef = useRef<WebSocket | null>(null);
  const dgNodeRef = useRef<AudioWorkletNode | null>(null);
  const dgSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dgWorkletReadyRef = useRef(false);
  const dgTokenRef = useRef<{ tok: SttTokenData; fetchedAt: number } | null>(null);
  const dgUnavailableRef = useRef(false); // set once we know no Deepgram key is configured

  // Which provider actually served the last turn (for the ?debug overlay)
  const sttSourceRef = useRef<'deepgram' | 'browser' | null>(null);
  const ttsSourceRef = useRef<'openai' | 'openai-mp3' | 'browser' | null>(null);

  // Enable per-turn timing logs by adding ?debug to the kiosk URL.
  useEffect(() => {
    debugRef.current = new URLSearchParams(window.location.search).has('debug');
  }, []);

  // ── Recognition cleanup ───────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
  }, []);

  // ── Deepgram STT cleanup ────────────────────────────────────────────────────────

  // Tear down the per-turn streaming graph + socket, but keep the mic stream and
  // AudioContext warm so the next turn doesn't re-prompt / re-init.
  const teardownDgTurn = useCallback(() => {
    if (dgWsRef.current) {
      try { dgWsRef.current.close(); } catch { /* ok */ }
      dgWsRef.current = null;
    }
    if (dgNodeRef.current) {
      try {
        dgNodeRef.current.port.onmessage = null;
        dgNodeRef.current.disconnect();
      } catch { /* ok */ }
      dgNodeRef.current = null;
    }
    if (dgSrcRef.current) {
      try { dgSrcRef.current.disconnect(); } catch { /* ok */ }
      dgSrcRef.current = null;
    }
  }, []);

  const stopDeepgram = useCallback(() => {
    teardownDgTurn();
    if (dgStreamRef.current) {
      for (const track of dgStreamRef.current.getTracks()) track.stop();
      dgStreamRef.current = null;
    }
    if (dgCtxRef.current) {
      dgCtxRef.current.close().catch(() => {});
      dgCtxRef.current = null;
    }
    dgWorkletReadyRef.current = false;
  }, [teardownDgTurn]);

  // ── Streaming TTS cleanup ───────────────────────────────────────────────────────

  const stopStreamAudio = useCallback(() => {
    if (audioAbortRef.current) {
      try { audioAbortRef.current.abort(); } catch { /* ok */ }
      audioAbortRef.current = null;
    }
    for (const src of streamSourcesRef.current) {
      try { src.stop(); } catch { /* already ended */ }
    }
    streamSourcesRef.current = [];
  }, []);

  // ── Reset to idle ─────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    stopRecognition();
    stopStreamAudio();
    stopDeepgram();

    if (audioSrcRef.current) {
      try { audioSrcRef.current.stop(); } catch { /* already ended */ }
      audioSrcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause(); // triggers onpause → resolves any pending speakText promise
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    messagesRef.current = [];
    kioskStateRef.current = 'idle';
    setKioskState('idle');
    setOrderItems([]);
    setOrderNumber(null);
    setCountdown(30);
    setErrorMsg('');
    setLastTranscript('');
    setAiResponse('');
  }, [stopRecognition, stopStreamAudio, stopDeepgram]);

  // ── Session lock ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionLockEnabled) return;

    const storageKey = `kiosk_session_${token}`;
    let sid = localStorage.getItem(storageKey) ?? '';
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(storageKey, sid);
    }
    sessionIdRef.current = sid;

    claimKioskSession(token, sid).then((res) => {
      if ('error' in res) {
        kioskStateRef.current = 'locked';
        setKioskState('locked');
      }
    });

    heartbeatRef.current = setInterval(async () => {
      const res = await heartbeatKioskSession(token, sessionIdRef.current);
      if ('error' in res) {
        kioskStateRef.current = 'stolen';
        setKioskState('stolen');
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [token, sessionLockEnabled]);

  // ── Countdown ─────────────────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    resetTimerRef.current = setTimeout(reset, 30_000);
  }, [reset]);

  // ── Unmount cleanup ───────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (audioSrcRef.current) { try { audioSrcRef.current.stop(); } catch { /* ok */ } }
      if (audioRef.current) audioRef.current.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      stopStreamAudio();
      stopRecognition();
      stopDeepgram();
    };
  }, [stopRecognition, stopStreamAudio, stopDeepgram]);

  // ── Audio helpers ─────────────────────────────────────────────────────────────

  function playAudioBlob(blob: Blob): Promise<void> {
    return new Promise<void>((resolve) => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        // Web Audio path — works regardless of autoplay policy once AudioContext is unlocked
        blob.arrayBuffer().then((ab) =>
          ctx.decodeAudioData(ab).then((decoded) => {
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            audioSrcRef.current = src;
            src.onended = () => { audioSrcRef.current = null; resolve(); };
            src.start(0);
          }).catch(() => resolve())
        ).catch(() => resolve());
      } else {
        // HTMLAudioElement fallback (no AudioContext available)
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        const cleanup = () => { URL.revokeObjectURL(url); audioRef.current = null; };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); resolve(); };
        audio.onpause = () => { if (!audio.ended) { cleanup(); resolve(); } };
        audio.play().catch(() => { cleanup(); resolve(); });
      }
    });
  }

  function speakWithBrowser(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  // Stream raw PCM from the backend and schedule chunks on the unlocked
  // AudioContext as they arrive — playback starts on the first chunk instead of
  // waiting for the full clip. Returns false to signal a fallback is needed.
  async function streamSpeak(text: string, ctx: AudioContext): Promise<boolean> {
    const controller = new AbortController();
    audioAbortRef.current = controller;
    streamSourcesRef.current = [];
    const fetchStart = performance.now();

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/v1/kiosk/${token}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, format: 'pcm' }),
        signal: controller.signal,
      });
    } catch {
      return false;
    }
    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    let nextStart = ctx.currentTime + 0.06; // small lead so the first chunk isn't clipped
    let leftover = new Uint8Array(0);
    let played = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;

        let bytes: Uint8Array;
        if (leftover.length) {
          bytes = new Uint8Array(leftover.length + value.length);
          bytes.set(leftover);
          bytes.set(value, leftover.length);
          leftover = new Uint8Array(0);
        } else {
          bytes = value;
        }
        const odd = bytes.length % 2; // 16-bit samples — carry a stray byte to next chunk
        if (odd) {
          leftover = bytes.slice(bytes.length - odd);
          bytes = bytes.subarray(0, bytes.length - odd);
        }
        if (bytes.length === 0) continue;

        const aligned = bytes.slice(); // fresh buffer at offset 0 for Int16Array
        const int16 = new Int16Array(aligned.buffer);
        const f32 = Float32Array.from(int16, (sample) => sample / 32768);

        const buffer = ctx.createBuffer(1, f32.length, TTS_SAMPLE_RATE);
        buffer.getChannelData(0).set(f32);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        const startAt = Math.max(nextStart, ctx.currentTime);
        src.start(startAt);
        nextStart = startAt + buffer.duration;
        streamSourcesRef.current.push(src);
        if (!played) {
          const ms = Math.round(performance.now() - fetchStart);
          ttsFirstAudioRef.current = ms;
          if (debugRef.current) {
            // eslint-disable-next-line no-console
            console.log(`[kiosk] tts_first_audio=${ms}ms`);
            // Reflect it in the overlay immediately, not after the clip ends.
            setDbg((prev) => (prev ? { ...prev, tts: ms } : prev));
          }
        }
        played = true;
      }
    } catch {
      return played; // aborted/read error — if some played, treat as handled
    } finally {
      if (audioAbortRef.current === controller) audioAbortRef.current = null;
    }

    if (!played) return false;

    const remainingMs = (nextStart - ctx.currentTime) * 1000 + 80;
    if (remainingMs > 0) await new Promise((r) => setTimeout(r, remainingMs));
    return true;
  }

  async function speakText(text: string): Promise<void> {
    if (!text.trim()) return;

    // Preferred path: stream on the already-unlocked AudioContext.
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      try {
        if (await streamSpeak(text, ctx)) { ttsSourceRef.current = 'openai'; return; }
      } catch { /* fall through to full-clip playback */ }
    }

    // Fallbacks: full mp3 blob, then the browser's built-in speech synthesis.
    const blob = await kioskSpeak(token, text);
    if (blob) { ttsSourceRef.current = 'openai-mp3'; await playAudioBlob(blob); return; }
    ttsSourceRef.current = 'browser';
    await speakWithBrowser(text);
  }

  // ── Browser SpeechRecognition (no API cost) ───────────────────────────────────

  function listenWithBrowser(): Promise<string> {
    return new Promise<string>((resolve) => {
      type SRConstructor = new () => SpeechRecognitionLike;
      const win = window as Window & {
        SpeechRecognition?: SRConstructor;
        webkitSpeechRecognition?: SRConstructor;
      };
      const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
      if (!SR) { resolve(''); return; }

      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = true; // stream partials so we end on our own silence timer
      recognition.maxAlternatives = 1;
      recognition.continuous = true;
      recognitionRef.current = recognition;

      let settled = false;
      let finalText = '';
      let interimText = '';
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        recognitionRef.current = null;
        try { recognition.abort(); } catch { /* already stopped */ }
        resolve(`${finalText} ${interimText}`.trim());
      };

      // Reset the end-of-speech countdown on any speech activity.
      const armSilence = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(finish, STT_SILENCE_MS);
      };

      recognition.onresult = (e) => {
        interimText = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const txt = result?.[0]?.transcript ?? '';
          if (result?.isFinal) finalText += txt;
          else interimText += txt;
        }
        armSilence();
      };
      recognition.onerror = () => finish();
      recognition.onend = () => finish();
      recognition.start();
    });
  }

  // ── Deepgram streaming STT (accurate; menu-aware) ─────────────────────────────

  async function fetchSttToken(): Promise<SttTokenData | null> {
    if (dgUnavailableRef.current) return null; // no key configured → don't keep asking
    // Reuse the token while it's still valid (with a 10s safety margin) so we
    // don't mint a new one every turn.
    const cached = dgTokenRef.current;
    if (cached && performance.now() - cached.fetchedAt < (cached.tok.expires_in - 10) * 1000) {
      return cached.tok;
    }
    try {
      const res = await fetch(`${API_BASE}/v1/kiosk/${token}/stt-token`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 503) {
        dgUnavailableRef.current = true; // key not configured — use browser recogniser
        // eslint-disable-next-line no-console
        if (debugRef.current) console.log('[kiosk] deepgram off: no DEEPGRAM_API_KEY on backend (503)');
        return null;
      }
      if (!res.ok) {
        // eslint-disable-next-line no-console
        if (debugRef.current) console.log(`[kiosk] deepgram token fetch failed: HTTP ${res.status}`);
        return null; // transient failure → retry next turn
      }
      const json = (await res.json()) as { data?: SttTokenData };
      const data = json.data?.access_token ? json.data : null;
      if (data) dgTokenRef.current = { tok: data, fetchedAt: performance.now() };
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      if (debugRef.current) console.log('[kiosk] deepgram token fetch error', err);
      return null;
    }
  }

  // Acquire the mic + AudioContext + worklet once, then reuse across turns.
  async function ensureDgAudio(): Promise<AudioContext | null> {
    try {
      if (!dgStreamRef.current) {
        dgStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      }
      if (!dgCtxRef.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        dgCtxRef.current = new Ctx();
      }
      const ctx = dgCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (!dgWorkletReadyRef.current) {
        await ctx.audioWorklet.addModule('/kiosk-stt-processor.js');
        dgWorkletReadyRef.current = true;
      }
      return ctx;
    } catch {
      return null;
    }
  }

  // Resolves with the transcript, '' when nothing was heard, or null to signal
  // "fall back to the browser recogniser".
  function listenWithDeepgram(tok: SttTokenData, ctx: AudioContext): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      let settled = false;
      let finalText = '';
      let interimText = '';
      let heardSpeech = false;
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let hardCap: ReturnType<typeof setTimeout> | null = null;
      let noSpeech: ReturnType<typeof setTimeout> | null = null;

      const done = (result: string | null) => {
        if (settled) return;
        settled = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        if (hardCap) clearTimeout(hardCap);
        if (noSpeech) clearTimeout(noSpeech);
        teardownDgTurn();
        resolve(result);
      };

      const sr = Math.round(ctx.sampleRate);
      const kw = (tok.keywords ?? [])
        .map((k) => `&keywords=${encodeURIComponent(`${k}:2`)}`)
        .join('');
      const url =
        `wss://api.deepgram.com/v1/listen?model=${encodeURIComponent(tok.model)}` +
        `&encoding=linear16&sample_rate=${sr}&channels=1&interim_results=true` +
        `&smart_format=true&punctuate=true&endpointing=${tok.endpointing_ms}${kw}`;

      let ws: WebSocket;
      try {
        // Grant tokens are JWTs → Bearer scheme (raw API keys would use 'token').
        ws = new WebSocket(url, ['bearer', tok.access_token]);
      } catch {
        done(null);
        return;
      }
      ws.binaryType = 'arraybuffer';
      dgWsRef.current = ws;

      const armSilence = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(
          () => done(`${finalText} ${interimText}`.trim()),
          STT_SILENCE_MS + 500,
        );
      };

      ws.onopen = () => {
        try {
          const source = ctx.createMediaStreamSource(dgStreamRef.current as MediaStream);
          const node = new AudioWorkletNode(ctx, 'kiosk-stt-processor');
          node.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(ev.data);
          };
          source.connect(node);
          // Keep the graph pulling audio without making it audible.
          const sink = ctx.createGain();
          sink.gain.value = 0;
          node.connect(sink).connect(ctx.destination);
          dgSrcRef.current = source;
          dgNodeRef.current = node;
        } catch {
          done(null);
          return;
        }
        // Customer never spoke → give up so the loop can re-arm.
        noSpeech = setTimeout(() => { if (!heardSpeech) done(''); }, 8000);
        // Absolute ceiling on a single turn.
        hardCap = setTimeout(() => done(`${finalText} ${interimText}`.trim()), 20000);
      };

      ws.onmessage = (ev: MessageEvent) => {
        let msg: DeepgramResult;
        try {
          msg = JSON.parse(ev.data as string) as DeepgramResult;
        } catch {
          return;
        }
        const txt = msg.channel?.alternatives?.[0]?.transcript ?? '';
        if (txt) {
          heardSpeech = true;
          if (msg.is_final) {
            finalText = `${finalText} ${txt}`.trim();
            interimText = '';
          } else {
            interimText = txt;
          }
          setLastTranscript(`${finalText} ${interimText}`.trim());
          armSilence();
        }
        // Deepgram's endpointing fired → the customer finished speaking.
        if (msg.speech_final && finalText.trim()) done(finalText.trim());
      };
      ws.onerror = () => done(finalText.trim() ? finalText.trim() : null);
      ws.onclose = () => {
        if (!settled) done(finalText.trim() ? `${finalText} ${interimText}`.trim() : null);
      };
    });
  }

  // Deepgram first (accurate, menu-aware); silently fall back to the free
  // browser recogniser if the key isn't set or anything goes wrong.
  async function listen(): Promise<string> {
    const tok = await fetchSttToken();
    if (tok) {
      const ctx = await ensureDgAudio();
      if (ctx) {
        const result = await listenWithDeepgram(tok, ctx);
        if (result !== null) {
          sttSourceRef.current = 'deepgram';
          return result;
        }
        // eslint-disable-next-line no-console
        if (debugRef.current) console.log('[kiosk] deepgram stream failed → browser fallback');
      } else if (debugRef.current) {
        // eslint-disable-next-line no-console
        console.log('[kiosk] mic/audio init failed → browser fallback');
      }
    }
    sttSourceRef.current = 'browser';
    return listenWithBrowser();
  }


  // ── Conversation loop ─────────────────────────────────────────────────────────

  function showError(msg: string) {
    setErrorMsg(msg);
    kioskStateRef.current = 'error';
    setKioskState('error');
    resetTimerRef.current = setTimeout(reset, 5000);
  }

  async function runConversation() {
    // Each iteration = one recording turn.
    // After every await we check the expected state; if wrong, someone called reset/endSession.
    while (true) {
      // ── Record + transcribe (Deepgram streaming; browser recogniser fallback) ──
      kioskStateRef.current = 'recording';
      setKioskState('recording');

      const sttStart = performance.now();
      const transcript = await listen();
      const sttMs = Math.round(performance.now() - sttStart);

      if (kioskStateRef.current !== 'recording') return;
      if (!transcript.trim()) continue; // nothing heard → loop back

      // ── Processing ──────────────────────────────────────────────────────────
      kioskStateRef.current = 'processing';
      setKioskState('processing');

      setLastTranscript(transcript);
      messagesRef.current.push({ role: 'user', content: transcript });

      // ── Chat ────────────────────────────────────────────────────────────────
      const chatStart = performance.now();
      const chatRes = await kioskChat(token, messagesRef.current);
      const chatMs = Math.round(performance.now() - chatStart);
      if (debugRef.current) {
        // eslint-disable-next-line no-console
        console.log(`[kiosk] stt=${sttMs}ms chat=${chatMs}ms`);
      }
      if (kioskStateRef.current !== 'processing') return;

      if ('error' in chatRes) {
        if (chatRes.error.code === 'KIOSK_LIMIT_REACHED') {
          kioskStateRef.current = 'unavailable';
          setKioskState('unavailable');
          return;
        }
        showError('Could not reach AI. Please try again.');
        return;
      }

      const { response, order_confirmed, order, debug } = chatRes.data;
      messagesRef.current.push({ role: 'assistant', content: response });
      setAiResponse(response);

      ttsFirstAudioRef.current = null;
      ttsSourceRef.current = null;
      const recordTiming = () => {
        if (!debugRef.current) return;
        setDbg({
          stt: sttMs,
          chat: chatMs,
          anthropicMs: debug?.anthropic_ms ?? null,
          cacheRead: debug?.cache_read ?? null,
          cacheWrite: debug?.cache_write ?? null,
          tts: ttsFirstAudioRef.current,
          sttSource: sttSourceRef.current,
          ttsSource: ttsSourceRef.current,
        });
      };
      recordTiming();

      if (order_confirmed) {
        setOrderItems(order?.items ?? []);
        setOrderNumber(
          order?.order_number ?? `#${Math.floor(Math.random() * 9000) + 1000}`,
        );
        kioskStateRef.current = 'confirmed';
        setKioskState('confirmed');
        await speakText(response);
        recordTiming();
        startCountdown();
        return; // loop ends — countdown handles reset
      }

      // ── Speak ───────────────────────────────────────────────────────────────
      kioskStateRef.current = 'speaking';
      setKioskState('speaking');
      await speakText(response);
      recordTiming();

      if (kioskStateRef.current !== 'speaking') return; // cancelled during playback
      // Loop → next recording turn
    }
  }

  async function startOrder() {
    if (kioskStateRef.current !== 'idle') return;

    // Unlock AudioContext on this user gesture — must happen before any await
    // so the browser grants audio playback for all subsequent speakText calls.
    try {
      type ACConstructor = typeof AudioContext;
      const AC = (
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: ACConstructor }).webkitAudioContext
      ) as ACConstructor | undefined;
      if (AC) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AC();
        }
        if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
      }
    } catch { /* AudioContext not supported — falls back to HTMLAudioElement */ }

    messagesRef.current = [];
    setLastTranscript('');
    setAiResponse('');
    await runConversation();
  }

  function endSession() {
    stopStreamAudio();
    if (audioSrcRef.current) { try { audioSrcRef.current.stop(); } catch { /* ok */ } }
    if (audioRef.current) audioRef.current.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopRecognition();
    reset();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLight = theme === 'light';
  const isActive =
    kioskState === 'recording' || kioskState === 'processing' || kioskState === 'speaking';

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden ${cfg.wrapperClass}`}
      style={cfg.wrapperStyle}
    >
      {/* Temporary latency overlay — only when ?debug is in the URL */}
      {dbg && (
        <div className="pointer-events-none fixed left-2 top-2 z-50 rounded-lg bg-black/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/90 shadow-lg">
          <div className="mb-1 font-semibold text-emerald-300">⏱ latency (last turn)</div>
          <div>stt: {dbg.stt}ms</div>
          <div>
            chat: {dbg.chat}ms
            {dbg.anthropicMs != null && (
              <> · api {dbg.anthropicMs}ms · net {Math.max(0, dbg.chat - dbg.anthropicMs)}ms</>
            )}
          </div>
          <div>cache: read {dbg.cacheRead ?? 0} / write {dbg.cacheWrite ?? 0}</div>
          <div>tts first audio: {dbg.tts != null ? `${dbg.tts}ms` : '…'}</div>

          <div className="mt-1 border-t border-white/20 pt-1 font-semibold text-sky-300">
            providers
          </div>
          <div>
            stt · {dbg.sttSource ?? '—'}{' '}
            <span className={dbg.sttSource === 'deepgram' ? 'text-emerald-300' : 'text-amber-300'}>
              {dbg.sttSource === 'deepgram'
                ? '● deepgram (accurate)'
                : dbg.sttSource === 'browser'
                  ? '● browser (fallback)'
                  : ''}
            </span>
          </div>
          <div>
            chat · claude{' '}
            {(() => {
              const r = rateMs(dbg.anthropicMs, 1000, 1800);
              return (
                <span className={r.cls}>
                  ● {dbg.anthropicMs != null ? `${dbg.anthropicMs}ms` : '—'} {r.label}
                </span>
              );
            })()}
          </div>
          <div>
            tts · {dbg.ttsSource === 'browser' ? 'browser' : 'openai'}
            {dbg.ttsSource === 'openai-mp3' ? ' (mp3)' : ''}{' '}
            {(() => {
              const r =
                dbg.ttsSource === 'browser'
                  ? { label: 'fallback', cls: 'text-amber-300' }
                  : rateMs(dbg.tts, 1200, 2000);
              return (
                <span className={r.cls}>
                  ● {dbg.tts != null ? `${dbg.tts}ms` : '—'} {r.label}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {/* Ambient glows — dark themes only */}
      {!isLight && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: `${cfg.accentColor}10` }}
          />
          {theme === 'gradient' && (
            <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-600/10 blur-3xl" />
          )}
        </div>
      )}

      {/* ── Header ── */}
      {isLight ? (
        <header className="relative z-10 bg-[#0A2540] px-6 py-5 text-center">
          <p className="text-3xl font-black tracking-tight text-white">{workspaceName}</p>
          <p className="mt-1 text-sm text-white/50">{locationName}</p>
        </header>
      ) : (
        <header className="relative z-10 flex flex-col items-center pt-10">
          <p className="text-3xl font-black tracking-tight text-white">{workspaceName}</p>
          <p className="mt-1 text-sm text-white/50">{locationName}</p>
        </header>
      )}

      {/* ── Main content ── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">

        {/* IDLE */}
        {kioskState === 'idle' && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="relative flex items-center justify-center">
              <span
                className="absolute h-64 w-64 animate-ping rounded-full"
                style={{ background: `${cfg.accentColor}12`, animationDuration: '2.5s' }}
              />
              <span
                className="absolute h-44 w-44 animate-ping rounded-full"
                style={{
                  background: `${cfg.accentColor}18`,
                  animationDuration: '2.5s',
                  animationDelay: '0.6s',
                }}
              />
              <button
                onClick={startOrder}
                className={`relative flex h-32 w-32 items-center justify-center rounded-full shadow-2xl ${cfg.buttonClass} ${cfg.buttonShadow} transition-all duration-200 hover:scale-105 active:scale-95`}
                aria-label="Start order"
              >
                <Mic className="h-14 w-14 text-white" />
              </button>
            </div>
            <div>
              <span
                className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${cfg.badgeClass}`}
              >
                Voice Ordering
              </span>
              <h1 className={`text-5xl font-black tracking-tight ${cfg.textPrimary}`}>
                Tap to Order
              </h1>
              <p className={`mt-3 text-lg ${cfg.textSecondary}`}>
                Speak your order — your AI assistant is ready
              </p>
            </div>
          </div>
        )}

        {/* RECORDING */}
        {kioskState === 'recording' && (
          <div className="flex flex-col items-center gap-10 text-center">
            <div className="flex items-end gap-2" aria-hidden>
              {SOUND_BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className={`w-2.5 rounded-full ${cfg.soundBarClass}`}
                  style={{
                    height: `${h}%`,
                    maxHeight: 96,
                    minHeight: 8,
                    animation: 'soundBar 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <div>
              <h1 className={`text-4xl font-bold ${cfg.textPrimary}`}>Listening…</h1>
              <p className={`mt-2 ${cfg.textSecondary}`}>Speak clearly — stops when you pause</p>
              {lastTranscript && (
                <p className={`mt-4 max-w-xs text-sm italic ${cfg.textSecondary} opacity-70`}>
                  "{lastTranscript}"
                </p>
              )}
            </div>
            <button
              onClick={endSession}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
              aria-label="End session"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* PROCESSING */}
        {kioskState === 'processing' && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div
              className="flex h-32 w-32 items-center justify-center rounded-full border-2"
              style={{ borderColor: `${cfg.accentColor}40`, background: `${cfg.accentColor}10` }}
            >
              <div
                className="h-12 w-12 animate-spin rounded-full border-4"
                style={{ borderColor: `${cfg.accentColor}30`, borderTopColor: cfg.accentColor }}
              />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${cfg.textPrimary}`}>Thinking…</h1>
              {lastTranscript && (
                <p className={`mt-3 max-w-xs text-sm italic ${cfg.textSecondary}`}>
                  You said: "{lastTranscript}"
                </p>
              )}
            </div>
          </div>
        )}

        {/* SPEAKING */}
        {kioskState === 'speaking' && (
          <div className="flex flex-col items-center gap-10 text-center">
            <div
              className="relative flex h-32 w-32 items-center justify-center rounded-full"
              style={{ background: `${cfg.accentColor}15` }}
            >
              <span
                className="absolute h-full w-full animate-ping rounded-full"
                style={{ background: `${cfg.accentColor}18`, animationDuration: '1.5s' }}
              />
              <svg
                className="relative h-14 w-14"
                style={{ color: cfg.accentColor }}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${cfg.textPrimary}`}>Responding…</h1>
              {aiResponse && (
                <p className={`mt-3 max-w-sm text-base ${cfg.textSecondary}`}>{aiResponse}</p>
              )}
            </div>
            <button
              onClick={endSession}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
              aria-label="End session"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* CONFIRMED */}
        {kioskState === 'confirmed' && (
          <div className="w-full max-w-md">
            <div
              className={`rounded-3xl p-8 text-center ${
                isLight
                  ? 'border border-slate-200 bg-white shadow-xl'
                  : 'border border-white/10 bg-white/5 backdrop-blur-sm'
              }`}
            >
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: `${cfg.accentColor}20` }}
              >
                <svg
                  className="h-10 w-10"
                  style={{ color: cfg.accentColor }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className={`mt-5 text-3xl font-black ${cfg.textPrimary}`}>Order Confirmed!</h1>
              {orderNumber && (
                <p className="mt-1 text-base font-semibold" style={{ color: cfg.accentColor }}>
                  Order {orderNumber}
                </p>
              )}
              {orderItems.length > 0 && (
                <ul className="mt-6 space-y-3 text-left">
                  {orderItems.map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between text-sm ${
                        isLight
                          ? 'border-b border-slate-100 pb-2'
                          : 'border-b border-white/10 pb-2'
                      }`}
                    >
                      <span className={`font-medium ${cfg.textPrimary}`}>
                        {item.qty}× {item.name}
                      </span>
                      {item.price && <span className={cfg.textSecondary}>{item.price}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className={`mt-6 text-sm ${cfg.textSecondary}`}>Your order is being prepared</p>
              <button
                type="button"
                onClick={reset}
                className="mt-6 w-full rounded-2xl px-6 py-4 text-base font-bold text-white transition active:scale-[0.98]"
                style={{ backgroundColor: cfg.accentColor }}
              >
                Go Back Now
              </button>
              <p className={`mt-3 text-xs ${cfg.textSecondary} opacity-60`}>
                Returning to home in {countdown}s
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {kioskState === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20">
              <span className="text-5xl">⚠️</span>
            </div>
            <h1 className={`text-2xl font-bold ${cfg.textPrimary}`}>{errorMsg}</h1>
            <p className={cfg.textSecondary}>Restarting in a moment…</p>
          </div>
        )}

        {/* LOCKED */}
        {kioskState === 'locked' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/20">
              <span className="text-5xl">🔒</span>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${cfg.textPrimary}`}>Kiosk in use</h1>
              <p className={`mt-2 max-w-xs ${cfg.textSecondary}`}>
                This kiosk is already running on another screen. Ask a staff member to regenerate
                the URL to move it here.
              </p>
            </div>
          </div>
        )}

        {/* STOLEN */}
        {kioskState === 'stolen' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20">
              <span className="text-5xl">🔄</span>
            </div>
            <h1 className={`text-2xl font-bold ${cfg.textPrimary}`}>Session ended</h1>
            <p className={`max-w-xs ${cfg.textSecondary}`}>
              This kiosk session was ended — a new URL has been generated for this location.
            </p>
          </div>
        )}

        {/* UNAVAILABLE (limit reached — customers see friendly message) */}
        {kioskState === 'unavailable' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-500/20">
              <span className="text-5xl">🙏</span>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${cfg.textPrimary}`}>Currently unavailable</h1>
              <p className={`mt-2 max-w-xs ${cfg.textSecondary}`}>
                The kiosk assistant is temporarily unavailable. Please order with a staff member —
                we apologize for any inconvenience.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className={`relative z-10 flex flex-col items-center pb-8 pt-4 ${
          isLight ? 'border-t border-slate-100' : ''
        }`}
      >
        {isActive && (
          <p
            className={`mb-3 text-xs font-medium ${isLight ? 'text-slate-400' : 'text-white/30'}`}
          >
            {kioskState === 'recording' && 'Listening — stops automatically when you pause'}
            {kioskState === 'processing' && 'Processing your order…'}
            {kioskState === 'speaking' && 'Next turn starts automatically after the response'}
          </p>
        )}
        <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-white/25'}`}>
          Powered by Convosol · VOAS.AI
        </p>
      </footer>

      <style>{`
        @keyframes soundBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
