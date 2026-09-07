'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'voas_pwa_install_dismissed';

// Chrome/Edge/Android fire this; it's not in the standard lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPhoneish = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ masquerades as macOS — detect via touch points.
  const iPadDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isSafari = !/crios|fxios|edgios/i.test(ua); // other iOS browsers can't install
  return (iPhoneish || iPadDesktop) && isSafari;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (localStorage.getItem(DISMISS_KEY)) return; // user dismissed before

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setHidden(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt — show the manual hint instead.
    if (isIos()) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setHidden(true);
    }
    setDeferred(null);
  }

  if (hidden || (!deferred && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-lg border bg-background p-4 shadow-md sm:inset-x-auto sm:right-4">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Install the VOAS app</p>
          {showIosHint ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the <Share className="inline h-3 w-3 align-text-bottom" /> Share button, then
              choose <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Get it on your home screen for a faster, full-screen experience.
              </p>
              <Button size="sm" className="mt-3" onClick={install}>
                <Download className="mr-1.5 h-4 w-4" />
                Install app
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
