import type { MetadataRoute } from 'next';
import { copy } from '@/lib/copy/es-ES';

/**
 * The install manifest.
 *
 * `display: standalone` and a `start_url` of the deck rather than the front
 * page: someone who has installed this has already signed in, and landing them
 * on a marketing page every time is a tax on the people who liked it most.
 *
 * No `screenshots` and no `shortcuts` yet — both want real screens rather than
 * placeholders, and an install dialog with a broken thumbnail in it is worse
 * than one without.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${copy.app.name} — ${copy.app.tagline}`,
    short_name: copy.app.name,
    description: copy.app.tagline,
    lang: copy.app.lang,
    dir: 'ltr',
    start_url: '/planes',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f1f4ef',
    theme_color: '#0e5c8c',
    categories: ['sports', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
