import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Server-side Supabase client, carrying the caller's session cookies so every
 * query runs as that user and RLS applies. This is the only client used for
 * reads — there is no service-role client in the app, because CLAUDE.md rule 5
 * says the service key never reaches the client and the simplest way to keep
 * that true is not to have one lying around at all.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to swallow.
        }
      },
    },
  });
}
