'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// True only when a Cloudflare Turnstile site key is configured. When false the
// widget renders nothing and callers pass no captchaToken — auth behaves exactly
// as before, so enabling CAPTCHA is a pure config flip (site key + Supabase).
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
    },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  /** Bump this to force a widget reset — Turnstile tokens are single-use. */
  resetSignal?: number;
}

export function Turnstile({ onVerify, resetSignal = 0 }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  function renderWidget() {
    if (!SITE_KEY || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => onVerify(token),
      'error-callback': () => onVerify(''),
      'expired-callback': () => onVerify(''),
      theme: 'auto',
    });
  }

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* already removed */
        }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onVerify('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}
