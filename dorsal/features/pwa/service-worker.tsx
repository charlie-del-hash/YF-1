'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, and nothing else.
 *
 * Deliberately renders no UI and asks for no permission: a page that requests
 * notifications on arrival is a page whose notifications get blocked at the
 * browser level for ever, and the block is not undoable from inside the app.
 * The asking happens on `Mi cuenta`, once, next to an explanation.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registration failing is not worth telling anyone about: the app works
    // without it, and the only thing lost is offline and notifications.
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}
