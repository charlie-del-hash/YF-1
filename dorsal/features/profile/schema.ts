import { z } from 'zod';

/**
 * A storage path, not a URL.
 *
 * `dorsales` is private, so what is stored is `<user id>/perfil` and the URL is
 * minted per render. Validating it as a URL — which is what the column name
 * `photo_url` invites — would accept `https://anywhere/tracker.gif` and turn
 * every profile render into a request to someone else's server.
 */
export const photoPathSchema = z
  .string()
  .regex(
    /^[0-9a-f-]{36}\/perfil$/,
    'photo_url must be "<user id>/perfil"',
  );
