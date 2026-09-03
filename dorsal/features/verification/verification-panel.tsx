'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/client';
import type { VerificationStatus } from '@/lib/database.types';

/**
 * Selfie verification, the manual kind.
 *
 * 05-RGPD §2 is the whole design: a person comparing two photographs is not
 * biometric processing, and an algorithm doing it is Article 9 special-category
 * data — a different legal project with a DPIA attached. Nothing here compares
 * anything, and the screen says so, because "we don't use face recognition" is
 * the sentence that makes people willing to do this at all.
 *
 * `capture="user"` asks the phone for the front camera and a photo taken now
 * rather than one chosen from the library, which is most of what makes the
 * check worth anything.
 */
export function VerificationPanel({ initialStatus }: { initialStatus: VerificationStatus | null }) {
  const [status, setStatus] = useState<VerificationStatus | null>(initialStatus);
  const [error, setError] = useState<string>();
  const [busy, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(undefined);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setError(copy.errors.notAuthenticated);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${auth.user.id}/selfie.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('verificaciones')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return setError(copy.verification.failed);

    const { error: rowError } = await supabase
      .from('verifications')
      .upsert(
        { user_id: auth.user.id, kind: 'selfie', status: 'pending', selfie_path: path },
        { onConflict: 'user_id,kind' },
      );
    if (rowError) return setError(copy.verification.failed);

    setStatus('pending');
  }

  if (status === 'approved') {
    return (
      <section className="painted p-4">
        <h2 className="font-display text-xl font-bold">{copy.verification.badge}</h2>
        <p className="mt-1 text-tinta-60">{copy.verification.approved}</p>
      </section>
    );
  }

  return (
    <section className="painted p-4">
      <h2 className="font-display text-xl font-bold">{copy.verification.title}</h2>
      <p className="mt-1 text-tinta-60">{copy.verification.help}</p>
      <p className="mt-1 text-[15px] text-tinta-60">{copy.verification.manualNote}</p>

      {status === 'pending' ? (
        <p className="mt-3 font-medium">{copy.verification.pending}</p>
      ) : (
        <>
          {status === 'rejected' ? (
            <p className="mt-3 text-aviso">{copy.verification.rejected}</p>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) startTransition(async () => void (await upload(file)));
            }}
          />
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {status === 'rejected' ? copy.verification.retry : copy.verification.take}
          </Button>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-aviso">
          {error}
        </p>
      ) : null}
    </section>
  );
}
