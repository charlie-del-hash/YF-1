'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { copy } from '@/lib/copy/es-ES';
import { siteUrl } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/client';

/**
 * Email magic link. No password, no social providers: every extra auth
 * provider is another processor in the privacy policy (CLAUDE.md), and this is
 * the flow that survives someone scanning a QR code at a rocódromo.
 */
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
    const { error: authError } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl()}/auth/callback${next}` },
    });

    if (authError) {
      setState('idle');
      setError(authError.status === 429 ? copy.auth.errors.rateLimited : copy.auth.errors.generic);
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
