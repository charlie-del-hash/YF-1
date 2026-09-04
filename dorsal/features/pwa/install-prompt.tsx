'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';

/** Chrome's install event, which TypeScript's DOM lib does not describe. */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED = 'dorsal:install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Safari's own, which is the only way to know on an iPhone.
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/**
 * The install invitation.
 *
 * Two different products behind one component. Chrome hands over a real
 * prompt; iOS has no API at all, so the only honest thing is to say which two
 * taps to make. Both are dismissible and stay dismissed — an install banner
 * that comes back is how a site gets closed.
 *
 * It matters more here than on most sites: on iOS, web push only works once
 * the app is on the Home Screen, so this is the door to notifications and not
 * just a nicety.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISSED) === '1') return;
    } catch {
      // A browser with storage blocked still gets the invitation; it just
      // cannot remember that it was dismissed.
    }
    setGone(false);
    setShowIos(isIos());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    setGone(true);
    try {
      window.localStorage.setItem(DISMISSED, '1');
    } catch {
      /* nothing to remember it with; the banner comes back next time */
    }
  }

  if (gone || (!event && !showIos)) return null;

  return (
    <section className="painted flex flex-col gap-2 p-4">
      <h2 className="font-display text-xl font-bold">{copy.install.title}</h2>
      <p className="text-tinta-60">{copy.install.help}</p>
      {event ? (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            onClick={async () => {
              await event.prompt();
              await event.userChoice;
              dismiss();
            }}
          >
            {copy.install.action}
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            {copy.install.later}
          </Button>
        </div>
      ) : (
        <>
          <p>{copy.install.ios}</p>
          <Button variant="secondary" className="self-start" onClick={dismiss}>
            {copy.install.later}
          </Button>
        </>
      )}
    </section>
  );
}
