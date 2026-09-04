'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { removeSubscription, saveSubscription, sendTestPush } from './actions';

type State = 'loading' | 'on' | 'off' | 'asking' | 'denied' | 'unsupported' | 'needs-install';

/**
 * The permission prompt, as a promise that always settles.
 *
 * Two problems with calling `Notification.requestPermission()` directly.
 * Safari before 16 only takes a callback and returns nothing to await. And in
 * a browser that suppresses the prompt — a managed profile, some automation —
 * the promise can simply never settle, which is how a button ends up saying
 * "Activando…" for ever. The same failure the sign-in form had, and the same
 * answer: never leave the person with no way out (decision 19).
 */
function requestPermission(): Promise<NotificationPermission> {
  return new Promise((resolve, reject) => {
    try {
      const maybe = Notification.requestPermission(resolve);
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
    } catch (cause) {
      reject(cause instanceof Error ? cause : new Error('permission_failed'));
    }
  });
}

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as { standalone?: boolean }).standalone === true;

/** The browser hands back keys as ArrayBuffers; the server wants base64url. */
function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** VAPID's base64url public key, as the subtle-crypto-facing API wants it. */
function toApplicationServerKey(base64Url: string): ArrayBuffer {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Turning notifications on, once, next to the sentence explaining what they
 * are for.
 *
 * The permission is requested by a tap and never on arrival: a browser-level
 * block is permanent and cannot be undone from inside the app, so asking at
 * the wrong moment does not cost a notification, it costs all of them.
 *
 * `vapidPublicKey` is passed in rather than read from the environment here so
 * that a deployment with no keys renders nothing at all — the feature is
 * absent rather than broken.
 */
export function PushPanel({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState<string>();
  const [said, setSaid] = useState<string>();
  const [busy, startTransition] = useTransition();
  // Set when the person gives up waiting for a prompt that never appeared, so
  // a promise that settles afterwards does not yank the panel back.
  const abandoned = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // On iOS the APIs only exist once the app is on the Home Screen, so the
      // useful message is "install it first", not "your browser cannot".
      setState(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') return setState('denied');

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? 'on' : 'off'))
      .catch(() => setState('off'));
  }, []);

  /** Everything after the permission is granted. Separate because it also runs
   *  when the answer arrives outside the promise — see the focus listener. */
  const subscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Web Push requires this to be true: a subscription that can send
        // silent pushes is one browsers refuse to create.
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(vapidPublicKey),
      });

      const result = await attempt(() =>
        saveSubscription({
          endpoint: subscription.endpoint,
          p256dh: toBase64Url(subscription.getKey('p256dh')),
          auth: toBase64Url(subscription.getKey('auth')),
        }),
      );
      if (!result.ok) {
        // Do not leave a subscription the server does not know about: the
        // browser would be waiting for messages nothing will ever send.
        await subscription.unsubscribe();
        setState('off');
        return setError(result.error);
      }
      setState('on');
    } catch {
      setState('off');
      setError(copy.push.failed);
    }
  }, [vapidPublicKey]);

  /**
   * While the browser is asking, the answer may arrive without the promise
   * ever settling — the person answers a prompt the page cannot see, or the
   * browser decides on its own. Coming back to the tab is the moment to look.
   */
  useEffect(() => {
    if (state !== 'asking') return;
    const check = () => {
      if (abandoned.current) return;
      if (Notification.permission === 'granted') void subscribe();
      else if (Notification.permission === 'denied') setState('denied');
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [state, subscribe]);

  function enable() {
    setError(undefined);
    setSaid(undefined);
    abandoned.current = false;
    if (Notification.permission === 'denied') return setState('denied');

    setState('asking');
    startTransition(async () => {
      let permission: NotificationPermission;
      try {
        permission = await requestPermission();
      } catch {
        // Whatever went wrong, the browser's own record of the answer is the
        // truth. Never leave the panel mid-question because of a rejection.
        permission = Notification.permission;
      }
      if (abandoned.current) return;

      if (permission === 'denied') return setState('denied');
      if (permission !== 'granted') {
        // Dismissed rather than blocked. Saying "you blocked these" to someone
        // who tapped outside the prompt is both wrong and a dead end.
        setState('off');
        return setError(copy.push.dismissed);
      }
      await subscribe();
    });
  }

  function disable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await attempt(() => removeSubscription(subscription.endpoint));
          await subscription.unsubscribe();
        }
        setState('off');
      } catch {
        setError(copy.push.failed);
      }
    });
  }

  if (state === 'loading') return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">{copy.push.title}</h2>
      <p className="text-tinta-60">{copy.push.help}</p>

      {state === 'asking' ? (
        <>
          <p>{copy.push.asking}</p>
          <p className="text-[15px] text-tinta-60">{copy.push.askingHelp}</p>
          {/* The way out. A prompt that never appears must not leave the panel
              saying "Activando…" for the rest of the session. */}
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => {
              abandoned.current = true;
              setState('off');
            }}
          >
            {copy.push.cancel}
          </Button>
        </>
      ) : state === 'denied' ? (
        <p className="text-aviso">{copy.push.denied}</p>
      ) : state === 'unsupported' ? (
        <p className="text-tinta-60">{copy.push.unsupported}</p>
      ) : state === 'needs-install' ? (
        <p className="text-tinta-60">{copy.push.needsInstall}</p>
      ) : state === 'on' ? (
        <>
          <p>{copy.push.on}</p>
          {said ? (
            <p role="status" className="text-cesped">
              {said}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {/* Every real notification goes to somebody else, so this is the
                only way to find out whether they arrive on this phone without
                arranging for a stranger to cancel a plan on you. */}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                startTransition(async () => {
                  setError(undefined);
                  setSaid(undefined);
                  const result = await attempt(() => sendTestPush());
                  if (result.ok) setSaid(copy.push.testSent);
                  else setError(result.error);
                })
              }
            >
              {copy.push.test}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={disable}>
              {copy.push.disable}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-tinta-60">{copy.push.off}</p>
          <Button className="self-start" disabled={busy} onClick={enable}>
            {busy ? copy.push.enabling : copy.push.enable}
          </Button>
        </>
      )}

      {error ? (
        <p role="alert" className="text-aviso">
          {error}
        </p>
      ) : null}
      <p className="text-[15px] text-tinta-60">{copy.push.privacy}</p>
    </section>
  );
}
