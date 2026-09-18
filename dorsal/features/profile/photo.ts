import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** How long a photo URL stays good for. One page view, with slack. */
const SIGNED_FOR_SECONDS = 600;

/**
 * Turns stored photo paths into URLs a browser can load.
 *
 * `dorsales` is a private bucket and stays private (migration 0006): a
 * photograph of someone's face next to their name and their district is not
 * something to make world-readable so that rendering is one line easier. So
 * `profiles.photo_url` holds a path, never a URL, and every render mints a
 * short-lived signed URL for the people who are allowed to see it.
 *
 * Batched, because a roster of eight would otherwise be eight round trips.
 */
export async function signPhotos(
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from('dorsales')
    .createSignedUrls(wanted, SIGNED_FOR_SECONDS);

  const signed = new Map<string, string>();
  for (const row of data ?? []) {
    // A path whose object has gone — deleted account, replaced photo — comes
    // back with an error rather than a URL. Absent is the right answer for it;
    // the caller already renders the no-photo case.
    if (row.path && row.signedUrl && !row.error) signed.set(row.path, row.signedUrl);
  }
  return signed;
}

/** One photo. Same rules, fewer round trips than pretending it is a list. */
export async function signPhoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await signPhotos([path])).get(path) ?? null;
}
