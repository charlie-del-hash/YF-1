'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Browser client. One instance per tab, so Realtime keeps a single socket. */
export function createClient() {
  cached ??= createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return cached;
}
