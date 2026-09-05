import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    //
    // `sw.js` is in this list because it was not, and the e2e run caught it:
    // the auth gate answered the service worker's own script with a redirect
    // to /entrar, so registration failed for everyone who was not already
    // signed in — which is everyone, the first time. A service worker is a
    // static file and there is nothing for a session check to decide about it.
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};
