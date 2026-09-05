'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/client';

/**
 * Email magic link. No password, no social providers: every extra auth
 * provider is another processor in the privacy policy (CLAUDE.md), and this is
 * the flow that survives someone scanning a QR code at a rocódromo.
 */
/**
 * A request that never reached the server is a connection problem, and saying
 * so is more useful than "we couldn't send it" — one tells you to check your
 * signal, the other tells you nothing. supabase-js reports these as a
 * retryable fetch error with no HTTP status.
 */
function authErrorMessage(error: { status?: number; name?: string }): string {
  if (error.status === 429) return copy.auth.errors.rateLimited;
  const unreachable = !error.status || /fetch|network|retryable|unknown/i.test(error.name ?? '');
  return unreachable ? copy.errors.network : copy.auth.errors.generic;
}

export function SignInForm({
  redirectTo,
  initialError,
}: {
  redirectTo?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | undefined>(initialError);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError(copy.auth.errors.invalidEmail);
      return;
    }
    setError(undefined);
    setState('sending');

    const next = redirectTo ? `?volver=${encodeURIComponent(redirectTo)}` : '';

    // The origin the person is actually on, rather than one assembled from
    // environment variables. This runs in their browser, so it is correct by
    // construction — on production, on a preview, on a custom domain, and on
    // localhost — and it cannot silently disagree with reality the way a
    // misconfigured NEXT_PUBLIC_SITE_URL can. That failure mode is nasty: the
    // link arrives, it just goes somewhere else, and it reads as "expired".
    //
    // The one requirement is that the origin is on Supabase's redirect
    // allow-list, which is true of exactly the origins that should work.
    const origin = window.location.origin;

    // signInWithOtp *rejects* when the request never completes, rather than
    // returning an error. Without this the button sits on "Mandando…" for ever.
    let authError: { status?: number; name?: string } | null = null;
    try {
      ({ error: authError } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${origin}/auth/callback${next}` },
      }));
    } catch {
      setState('idle');
      setError(copy.errors.network);
      return;
    }

    if (authError) {
      setState('idle');
      setError(authErrorMessage(authError));
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="painted p-4">
        <p className="font-medium">{copy.auth.sent}</p>
        <p className="mt-1 text-[15px] text-tinta-60">{copy.auth.checkSpam}</p>
        <Button variant="quiet" className="mt-3 px-0" onClick={() => setState('idle')}>
          {copy.common.back}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={copy.auth.emailLabel} error={error}>
        {(props) => (
          <input
            {...props}
            className={inputClass}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={copy.auth.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}
      </Field>
      <Button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? copy.auth.sending : copy.auth.submit}
      </Button>
    </form>
  );
}
