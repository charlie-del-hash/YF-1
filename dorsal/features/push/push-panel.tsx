'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { removeSubscription, saveSubscription, sendTestPush } from './actions';

type State = 'loading' | 'on' | 'off' | 'denied' | 'unsupported' | 'needs-install';

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

  function enable() {
    setError(undefined);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return setState('denied');

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
          return setError(result.error);
        }
        setState('on');
      } catch {
        setError(copy.push.failed);
      }
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

      {state === 'denied' ? (
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
