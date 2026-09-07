/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next — the list of assets to precache.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// --- Web Push: show a notification when the backend pushes to this device ----
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? (event.data.json() as typeof data) : {};
  } catch {
    /* malformed payload — fall back to defaults */
  }
  const title = data.title || 'VOAS AI';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
    }),
  );
});

// Focus an existing window (or open one) and navigate to the notification's link.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url =
    (event.notification.data && (event.notification.data as { url?: string }).url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          void client.focus();
          void (client as WindowClient).navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url).then(() => undefined);
    }),
  );
});
