'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';
import { createClient } from '@/lib/supabase/client';

/** 5 MB. A phone photo is under it; a screenshot of a RAW file is not. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Adding a profile photo.
 *
 * One object per person at `<user id>/perfil`, overwritten on change, which is
 * what the storage policies in 0006 are written around. The bucket is private,
 * so the preview here is the local file rather than a signed URL — the bytes
 * are already in the browser and a round trip to see what you just chose would
 * be slower and no more honest.
 *
 * The upload happens on selection rather than on save, because onboarding's
 * last step already ends in a submit and two pending states on one screen is
 * how people end up tapping `Listo` while a file is still going up.
 */
export function PhotoPicker({
  path,
  onChange,
  onError,
  initialPreview = null,
}: {
  path: string | null;
  /**
   * Optional only so the component reference at /kit can render the resting
   * state — a server component cannot pass a function across. Every real use
   * passes one; without it the upload succeeds and nothing records the path.
   */
  onChange?: (path: string | null) => void;
  onError?: (message: string | undefined) => void;
  /** A signed URL for a photo already saved, so it shows before any change. */
  initialPreview?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const [busy, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function fail(message: string) {
    onError?.(message);
    return null;
  }

  async function upload(file: File) {
    onError?.(undefined);
    if (!file.type.startsWith('image/')) return fail(copy.onboarding.identity.photoNotAnImage);
    if (file.size > MAX_BYTES) return fail(copy.onboarding.identity.photoTooBig);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fail(copy.errors.notAuthenticated);

    const objectPath = `${auth.user.id}/perfil`;
    const { error } = await supabase.storage
      .from('dorsales')
      .upload(objectPath, file, {
        upsert: true,
        contentType: file.type,
        // Short, because the path never changes: a replaced photo has to stop
        // being the one people see quickly, not in an hour.
        cacheControl: '60',
      });
    if (error) return fail(copy.onboarding.identity.photoFailed);

    setPreview(URL.createObjectURL(file));
    onChange?.(objectPath);
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {/* Decorative: the person's own name is next to it on every screen this
          appears on, so announcing the image again would only be noise. */}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-20 w-20 rounded-full border border-borde object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-borde text-tinta-60"
        >
          {copy.onboarding.identity.photoLabel}
        </span>
      )}

      <div className="flex flex-col items-start gap-1">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={copy.onboarding.identity.photoLabel}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) startTransition(async () => void (await upload(file)));
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy
            ? copy.onboarding.identity.photoUploading
            : path
              ? copy.onboarding.identity.photoChange
              : copy.onboarding.identity.photoAdd}
        </Button>
        {path ? (
          <Button
            variant="quiet"
            className="px-0"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              onChange?.(null);
            }}
          >
            {copy.onboarding.identity.photoRemove}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
