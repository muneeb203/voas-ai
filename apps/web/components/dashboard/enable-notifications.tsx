'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  getPushConfigAction,
  subscribePushAction,
  unsubscribePushAction,
} from '@/app/actions/push-action';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function EnableNotifications() {
  const [supported, setSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const ok =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      if (!ok) {
        setReady(true);
        return;
      }
      // Backend must have VAPID keys configured, or there's nothing to enable.
      const cfg = await getPushConfigAction();
      if (cancelled) return;
      if ('error' in cfg || !cfg.data.configured || !cfg.data.public_key) {
        setReady(true);
        return;
      }
      setSupported(true);
      setPublicKey(cfg.data.public_key);
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(existing));
      } catch {
        /* ignore */
      }
      if (!cancelled) setReady(true);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications were blocked. Enable them in your browser settings.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        toast.error('Could not read the subscription. Try again.');
        return;
      }
      const res = await subscribePushAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSubscribed(true);
      toast.success('Notifications enabled on this device.');
    } catch {
      toast.error('Could not enable notifications on this device.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) await unsubscribePushAction(endpoint);
      setSubscribed(false);
      toast.success('Notifications turned off on this device.');
    } catch {
      toast.error('Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !supported) return null;

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : subscribed ? (
        <BellOff className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {subscribed ? 'Turn off device notifications' : 'Enable device notifications'}
    </button>
  );
}
