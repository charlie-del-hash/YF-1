import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from './env';

/** Routes reachable without a session. Everything else redirects to /entrar. */
const PUBLIC_PATHS = [
  '/entrar',
  '/auth',
  '/legal',
  '/manifest.webmanifest',
  // The component reference. No user data, noindexed — it exists so the design
  // pass in 03-DESIGN-BRIEF can be screenshotted and criticised repeatably.
  '/kit',
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Refreshes the auth token on every request and gates the authed shell.
 *
 * The gate lives here rather than in each page because a route that forgets it
 * is a data leak in a product whose whole safety story is "strangers only meet
 * inside a plan". RLS is still the real boundary — this is the polite layer.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // With no Supabase configuration nobody can be signed in, so the authed
  // shell must be closed rather than left to throw halfway through rendering.
  if (!supabaseConfigured()) {
    if (isPublic(request.nextUrl.pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever the cookie claims.
  const { data } = await supabase.auth.getUser();

  if (!data.user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('volver', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
