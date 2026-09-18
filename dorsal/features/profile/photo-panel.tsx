'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { copy } from '@/lib/copy/es-ES';
import { attempt } from '@/lib/actions';
import { PhotoPicker } from './photo-picker';
import { setMyPhoto } from './actions';

/**
 * Changing your photo after onboarding.
 *
 * The picker puts the bytes in storage; this writes the path onto the profile
 * row, which is the step that makes it the photo other people see. Two calls
 * rather than one because the upload is the slow part and it should be visible
 * before the save is asked for.
 */
export function PhotoPanel({
  initialPath,
  initialUrl,
}: {
  initialPath: string | null;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [path, setPath] = useState(initialPath);
  const [error, setError] = useState<string>();
  const [said, setSaid] = useState<string>();
  const [saving, startTransition] = useTransition();

  function save(next: string | null) {
    setPath(next);
    setSaid(undefined);
    startTransition(async () => {
      const result = await attempt(() => setMyPhoto(next));
      if (!result.ok) {
        setPath(path);
        return setError(result.error);
      }
      setSaid(next ? copy.onboarding.identity.photoAdded : undefined);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">{copy.onboarding.identity.photoLabel}</h2>
      <PhotoPicker
        path={path}
        onChange={save}
        onError={setError}
        initialPreview={initialUrl}
      />
      <p className="text-[15px] text-tinta-60" role="status">
        {error ?? said ?? (saving ? copy.create.saving : copy.onboarding.identity.photoPrivate)}
      </p>
    </section>
  );
}
