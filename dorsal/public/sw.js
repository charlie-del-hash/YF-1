/*
 * Dorsal's service worker.
 *
 * Two jobs: receive notifications, and keep the app openable when the metro
 * goes into a tunnel. It deliberately does NOT cache pages. Every screen here
 * is somebody's roster, chat or profile, and a service worker that serves a
 * stale one — or worse, serves one person's page to the next person on the
 * device — is a far bigger problem than a page that fails to load. Only
 * Next.js's own immutable build assets are cached, and they are content-hashed.
 */

const VERSION = 'dorsal-v1';
const SHELL = `${VERSION}-shell`;
const OFFLINE_URL = '/sin-conexion';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Build output is content-hashed and immutable, so this is safe and is most
  // of what makes a second launch feel instant.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Everything else is network-only. A navigation that fails gets the offline
  // page rather than the browser's dinosaur; nothing authenticated is stored.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
});

/*
 * A notification.
 *
 * The payload is decrypted by the browser before it reaches here — the push
 * service forwarded bytes it could not read. A push with no payload still
 * shows something, because a silent push is a permission quietly spent.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Dorsal';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || undefined,
      data: { url: payload.url || '/planes' },
      lang: 'es-ES',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/planes', self.location.origin);

  // Reuse the tab that is already open rather than stacking up windows.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          client.navigate(target.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
