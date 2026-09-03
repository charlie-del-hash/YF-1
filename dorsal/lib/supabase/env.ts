/**
 * One place that reads Supabase configuration, so a missing variable is a
 * clear message at startup rather than an opaque 401 at runtime.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in — ` +
        'the Supabase project must be in an EU region (see 05-RGPD).',
    );
  }
  return value;
}

export const supabaseUrl = (): string =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * The browser-side key. Supabase renamed these from "anon" (a JWT) to
 * "publishable" (`sb_publishable_…`) — both are safe to ship to a browser and
 * both are passed the same way, so either variable name is accepted rather than
 * forcing a rename on whichever the project happens to have issued.
 */
export const supabaseAnonKey = (): string =>
  required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

/** True when the app has enough configuration to talk to Supabase at all. */
export const supabaseConfigured = (): boolean =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );

export const siteUrl = (): string =>
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
