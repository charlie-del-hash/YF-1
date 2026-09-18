import { copy } from '@/lib/copy/es-ES';

/** The shape every action in this app returns. */
export type ActionOutcome = { ok: true } | { ok: false; error: string };

/**
 * Runs a server action and turns a *thrown* failure into a returned one.
 *
 * Server actions reject rather than resolve when the request never completes —
 * no connection, a deploy mid-flight, a 500. Every call site here sets a
 * pending flag before the call and clears it after, so an unhandled rejection
 * leaves the button saying "Mandando…" or "Guardando…" for ever, with nothing
 * for the person to act on. That is exactly what happened with an unreachable
 * Supabase project, and it is why this exists rather than a try/catch repeated
 * at eight call sites.
 */
export async function attempt<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, error: copy.errors.network };
  }
}
