'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { copy } from '@/lib/copy/es-ES';
import { photoPathSchema } from './schema';

/**
 * Setting or clearing your own profile photo.
 *
 * The path is re-checked against the caller's own id here rather than trusted
 * from the client: storage policy already refuses a write outside your own
 * folder, but `profiles.photo_url` is an ordinary column and nothing else would
 * stop someone pointing it at another person's object.
 */
export async function setMyPhoto(
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: copy.errors.notAuthenticated };

  if (path !== null) {
    const parsed = photoPathSchema.safeParse(path);
    if (!parsed.success || !path.startsWith(`${auth.user.id}/`)) {
      return { ok: false, error: copy.onboarding.identity.photoFailed };
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ photo_url: path })
    .eq('id', auth.user.id);
  if (error) return { ok: false, error: copy.onboarding.identity.photoFailed };

  // The bytes go too, otherwise "quitar la foto" only hides it. Failure here is
  // not surfaced: the photo is already unreachable from the app, and an orphan
  // object is a cleanup problem rather than something to make the person retry.
  if (path === null) {
    await supabase.storage.from('dorsales').remove([`${auth.user.id}/perfil`]);
  }

  revalidatePath('/mi-dorsal');
  revalidatePath('/planes');
  return { ok: true };
}
