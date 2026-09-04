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

/**
 * Where a magic link comes back to.
 *
 * `NEXT_PUBLIC_SITE_URL` used to be required, which made the first deploy
 * circular: you cannot know the address until Vercel has given you one, so the
 * first deploy always had the wrong value and sign-in failed in the way that
 * looks exactly like an expired link.
 *
 * Vercel exposes its own system variables, so production can answer this
 * itself. `PROJECT_PRODUCTION_URL` is the stable domain and is preferred;
 * `VERCEL_URL` is unique per deployment and is only a fallback, because a
 * per-deployment address can never be on Supabase's redirect allow-list. An
 * explicit `NEXT_PUBLIC_SITE_URL` still wins, for a custom domain.
 */
export const siteUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const production = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production.replace(/\/$/, '')}`;

  const deployment = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (deployment) return `https://${deployment.replace(/\/$/, '')}`;

  return 'http://localhost:3000';
};
