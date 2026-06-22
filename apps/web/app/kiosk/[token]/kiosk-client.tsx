'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { claimKioskSession, heartbeatKioskSession } from '@/lib/api/kiosk-public';

interface KioskClientProps {
  token: string;
  locationName: string;
  workspaceName: string;
  vapiPublicKey: string;
  vapiAssistantId: string;
  theme: 'warm' | 'light' | 'gradient';
  sessionLockEnabled: boolean;
}

type KioskState = 'idle' | 'connecting' | 'active' | 'confirmed' | 'error' | 'locked' | 'stolen';

interface OrderItem {
  name: string;
  qty: number;
  price?: string;
}

const SOUND_BAR_HEIGHTS = [30, 55, 80, 100, 80, 55, 30, 55, 80, 55];
const HEARTBEAT_INTERVAL_MS = 25_000;

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
  separateHeader: boolean;
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
    separateHeader: false,
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
    separateHeader: true,
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
    separateHeader: false,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function KioskClient({
  token,
  locationName,
  workspaceName,
  vapiPublicKey,
  vapiAssistantId,
  theme,
  sessionLockEnabled,
}: KioskClientProps) {
  const cfg = THEME_CFG[theme] ?? THEME_CFG.gradient;

  const [kioskState, setKioskState] = useState<KioskState>('idle');
  const [muted, setMuted] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');

  const vapiRef = useRef<unknown>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kioskStateRef = useRef<KioskState>('idle');
  const sessionIdRef = useRef<string>('');

  // ── Session lock setup ──────────────────────────────────────────────────────

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

  // ── Core helpers ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    const v = vapiRef.current as { stop?: () => void } | null;
    v?.stop?.();
    vapiRef.current = null;
    kioskStateRef.current = 'idle';
    setKioskState('idle');
    setMuted(false);
    setOrderItems([]);
    setOrderNumber(null);
    setCountdown(30);
    setErrorMsg('');
  }, []);

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

  useEffect(() => {
    return () => {
      const v = vapiRef.current as { stop?: () => void } | null;
      v?.stop?.();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  async function startOrder() {
    if (kioskState !== 'idle') return;
    setKioskState('connecting');
    try {
      const { default: Vapi } = await import('@vapi-ai/web');
      const vapi = new Vapi(vapiPublicKey);
      vapiRef.current = vapi;

      vapi.on('call-start', () => setKioskState('active'));

      vapi.on('call-end', () => {
        if (kioskStateRef.current !== 'confirmed') reset();
      });

      vapi.on('message', (msg: unknown) => {
        const m = msg as {
          type?: string;
          toolCallList?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
        if (m?.type === 'tool-calls' && m.toolCallList?.length) {
          const call = m.toolCallList[0];
          if (call?.function?.name === 'confirm_order') {
            try {
              const args = JSON.parse(call.function.arguments ?? '{}') as {
                items?: OrderItem[];
                order_number?: string;
              };
              setOrderItems(args.items ?? []);
              setOrderNumber(
                args.order_number ?? `#${Math.floor(Math.random() * 9000) + 1000}`,
              );
            } catch {
              // args unparseable — still show confirmed
            }
            kioskStateRef.current = 'confirmed';
            setKioskState('confirmed');
            const v = vapiRef.current as { stop?: () => void } | null;
            v?.stop?.();
            startCountdown();
          }
        }
      });

      vapi.on('error', () => {
        setErrorMsg('Something went wrong. Please try again.');
        setKioskState('error');
        resetTimerRef.current = setTimeout(reset, 5000);
      });

      await vapi.start(vapiAssistantId);
    } catch {
      setErrorMsg('Could not connect. Please try again.');
      setKioskState('error');
      resetTimerRef.current = setTimeout(reset, 5000);
    }
  }

  function endCall() {
    const v = vapiRef.current as { stop?: () => void } | null;
    v?.stop?.();
    reset();
  }

  function toggleMute() {
    const v = vapiRef.current as { setMuted?: (m: boolean) => void } | null;
    const next = !muted;
    v?.setMuted?.(next);
    setMuted(next);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isLight = theme === 'light';

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden ${cfg.wrapperClass}`}
      style={cfg.wrapperStyle}
    >
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
              <span className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${cfg.badgeClass}`}>
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

        {/* CONNECTING */}
        {kioskState === 'connecting' && (
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
              <h1 className={`text-3xl font-bold ${cfg.textPrimary}`}>Connecting…</h1>
              <p className={`mt-2 ${cfg.textSecondary}`}>Setting up your AI assistant</p>
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {kioskState === 'active' && (
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
              <h1 className={`text-4xl font-bold ${cfg.textPrimary}`}>
                {muted ? 'Muted' : 'Listening…'}
              </h1>
              <p className={`mt-2 ${cfg.textSecondary}`}>Speak your order clearly</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleMute}
                className={`flex h-14 w-14 items-center justify-center rounded-full border ${
                  isLight
                    ? 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'
                } transition`}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <button
                onClick={endCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
                aria-label="End session"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
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
                        isLight ? 'border-b border-slate-100 pb-2' : 'border-b border-white/10 pb-2'
                      }`}
                    >
                      <span className={`font-medium ${cfg.textPrimary}`}>
                        {item.qty}× {item.name}
                      </span>
                      {item.price && (
                        <span className={cfg.textSecondary}>{item.price}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className={`mt-6 text-sm ${cfg.textSecondary}`}>Your order is being prepared</p>
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

        {/* LOCKED — another device is using this URL */}
        {kioskState === 'locked' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/20">
              <span className="text-5xl">🔒</span>
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${cfg.textPrimary}`}>Kiosk in use</h1>
              <p className={`mt-2 max-w-xs ${cfg.textSecondary}`}>
                This kiosk is already running on another screen. Ask a staff member to regenerate
                the URL if you need to move it to this device.
              </p>
            </div>
          </div>
        )}

        {/* STOLEN — heartbeat was taken over */}
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
      </main>

      {/* ── Footer ── */}
      <footer className={`relative z-10 flex flex-col items-center pb-8 pt-4 ${isLight ? 'border-t border-slate-100' : ''}`}>
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
