/**
 * A profile photo, where there is one.
 *
 * Renders nothing at all when there is not, rather than an initial or a grey
 * silhouette: the bib number is already the identifier on every screen this
 * appears on, and a placeholder avatar next to it is two answers to the same
 * question. `alt` is empty on purpose — the person's name is beside it, and
 * announcing the image again is noise for a screen reader.
 *
 * The URL is short-lived and minted server-side; the bucket is private. See
 * features/profile/photo.ts.
 */
export function Avatar({ url, size = 'md' }: { url: string | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!url) return null;
  const px = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`${px} shrink-0 rounded-full border border-borde object-cover`}
    />
  );
}
