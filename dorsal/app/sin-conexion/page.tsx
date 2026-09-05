import type { Metadata } from 'next';
import { copy } from '@/lib/copy/es-ES';

export const metadata: Metadata = { title: copy.offline.title, robots: { index: false } };

/**
 * What the service worker serves when a navigation cannot reach the network.
 *
 * Precached at install time, which is why it is a static page with no data on
 * it: anything else would be a stale copy of somebody's roster.
 */
export default function OfflinePage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 px-5 py-8"
    >
      <h1 className="font-display text-3xl font-bold">{copy.offline.title}</h1>
      <p className="text-tinta-60">{copy.offline.body}</p>
      {/* A hard navigation on purpose. next/link would try to fetch the route's
          payload over the connection that just failed and leave the person on
          this page with no feedback; a full load either works or shows the
          browser's own error, which is at least an answer. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/planes"
        className="tap inline-flex items-center justify-center rounded-[4px] bg-pista px-4 font-medium text-linea"
      >
        {copy.offline.retry}
      </a>
    </main>
  );
}
