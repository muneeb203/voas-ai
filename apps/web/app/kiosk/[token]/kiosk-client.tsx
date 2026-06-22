'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';

interface KioskClientProps {
  locationName: string;
  workspaceName: string;
  vapiPublicKey: string;
  vapiAssistantId: string;
}

type KioskState = 'idle' | 'connecting' | 'active' | 'confirmed' | 'error';

interface OrderItem {
  name: string;
  qty: number;
  price?: string;
}

const SOUND_BAR_HEIGHTS = [30, 55, 80, 100, 80, 55, 30, 55, 80, 55];

export function KioskClient({
  locationName,
  workspaceName,
  vapiPublicKey,
  vapiAssistantId,
}: KioskClientProps) {
  const [kioskState, setKioskState] = useState<KioskState>('idle');
  const [muted, setMuted] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [errorMsg, setErrorMsg] = useState('');
  const vapiRef = useRef<unknown>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kioskStateRef = useRef<KioskState>('idle');

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
    resetTimerRef.current = setTimeout(reset, 30000);
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
        const m = msg as { type?: string; toolCallList?: Array<{ function?: { name?: string; arguments?: string } }> };
        if (m?.type === 'tool-calls' && m.toolCallList?.length) {
          const call = m.toolCallList[0];
          if (call?.function?.name === 'confirm_order') {
            try {
              const args = JSON.parse(call.function.arguments ?? '{}') as {
                items?: OrderItem[];
                order_number?: string;
              };
              setOrderItems(args.items ?? []);
              setOrderNumber(args.order_number ?? `#${Math.floor(Math.random() * 9000) + 1000}`);
              kioskStateRef.current = 'confirmed';
              setKioskState('confirmed');
              const v = vapiRef.current as { stop?: () => void } | null;
              v?.stop?.();
              startCountdown();
            } catch {
              kioskStateRef.current = 'confirmed';
              setKioskState('confirmed');
              startCountdown();
            }
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

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0A2540]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C2A8]/8 blur-3xl" />
      </div>

      {/* Top branding */}
      <header className="relative z-10 flex flex-col items-center pt-10">
        <p className="text-2xl font-bold tracking-tight text-white">
          VOAS<span className="text-[#00C2A8]">.AI</span>
        </p>
        <p className="mt-1 text-sm font-medium text-white/50">{workspaceName} · {locationName}</p>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* IDLE */}
        {kioskState === 'idle' && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute h-56 w-56 animate-ping rounded-full bg-[#00C2A8]/10" style={{ animationDuration: '2.5s' }} />
              <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#00C2A8]/15" style={{ animationDuration: '2.5s', animationDelay: '0.6s' }} />
              <button
                onClick={startOrder}
                className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[#00C2A8] shadow-2xl shadow-[#00C2A8]/30 transition-all duration-200 hover:scale-105 hover:shadow-[#00C2A8]/50 active:scale-95"
                aria-label="Start order"
              >
                <Mic className="h-12 w-12 text-white" />
              </button>
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Tap to Order
              </h1>
              <p className="mt-3 text-lg text-white/50">
                Speak your order and our AI will take care of the rest
              </p>
            </div>
          </div>
        )}

        {/* CONNECTING */}
        {kioskState === 'connecting' && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#00C2A8]/40 bg-[#00C2A8]/10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00C2A8]/30 border-t-[#00C2A8]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Connecting…</h1>
              <p className="mt-2 text-white/50">Setting up your AI assistant</p>
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {kioskState === 'active' && (
          <div className="flex flex-col items-center gap-10 text-center">
            <div className="flex items-end gap-1.5" aria-hidden>
              {SOUND_BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-[#00C2A8]"
                  style={{
                    height: `${h}%`,
                    maxHeight: 80,
                    minHeight: 8,
                    animation: `soundBar 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {muted ? 'Muted' : 'Listening…'}
              </h1>
              <p className="mt-2 text-white/50">Speak your order clearly</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 transition hover:bg-white/20"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                onClick={endCall}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
                aria-label="End session"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMED */}
        {kioskState === 'confirmed' && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#00C2A8]/20">
                <svg className="h-8 w-8 text-[#00C2A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-white">Order Confirmed!</h1>
              {orderNumber && (
                <p className="mt-1 text-sm text-[#00C2A8]">Order {orderNumber}</p>
              )}
              {orderItems.length > 0 && (
                <ul className="mt-6 space-y-2 text-left">
                  {orderItems.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white/80">
                        {item.qty}× {item.name}
                      </span>
                      {item.price && (
                        <span className="text-white/50">{item.price}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 text-sm text-white/50">Your order is being prepared</p>
              <p className="mt-4 text-xs text-white/30">
                Returning to home in {countdown}s
              </p>
            </div>
          </div>
        )}

        {/* ERROR */}
        {kioskState === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-white">{errorMsg}</h1>
            <p className="text-sm text-white/50">Restarting in a moment…</p>
          </div>
        )}
      </main>

      {/* Bottom branding */}
      <footer className="relative z-10 flex flex-col items-center pb-8 pt-4">
        <p className="text-xs text-white/25">Powered by Convosol · voas.ai</p>
      </footer>

      {/* Sound bar keyframe injected via style tag */}
      <style>{`
        @keyframes soundBar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
