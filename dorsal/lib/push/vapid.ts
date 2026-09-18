import { createPrivateKey, sign } from 'node:crypto';
import { fromBase64Url, toBase64Url } from './encoding';

/**
 * VAPID (RFC 8292): how a push service knows which application server is
 * asking, without anyone holding an account with it.
 *
 * The keys are the pair `pnpm push:keys` prints. The public one is handed to
 * the browser at subscribe time and ends up baked into the subscription; the
 * private one signs a short-lived JWT per request and never leaves the server.
 */

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 point. */
  publicKey: string;
  /** base64url, 32-byte private scalar. */
  privateKey: string;
  /** RFC 8292 §2.1: a mailto: or https: the push service can complain to. */
  subject: string;
}

/** Twelve hours. The RFC caps it at 24; shorter costs nothing. */
const LIFETIME_SECONDS = 12 * 60 * 60;

function toJwk(keys: VapidKeys) {
  const publicKey = fromBase64Url(keys.publicKey);
  const privateKey = fromBase64Url(keys.privateKey);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new Error('bad_vapid_public_key');
  if (privateKey.length !== 32) throw new Error('bad_vapid_private_key');
  return {
    kty: 'EC' as const,
    crv: 'P-256' as const,
    x: toBase64Url(publicKey.subarray(1, 33)),
    y: toBase64Url(publicKey.subarray(33, 65)),
    d: toBase64Url(privateKey),
  };
}

/**
 * The `Authorization` header for one request to one push service.
 *
 * `aud` is the *origin* of the endpoint and nothing more: a push service will
 * reject a token whose audience is the full URL, and the full URL is a user
 * identifier that has no business being inside a signed claim anyway.
 */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): string {
  const audience = new URL(endpoint).origin;
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64Url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + LIFETIME_SECONDS,
        sub: keys.subject,
      }),
    ),
  );

  const signingInput = `${header}.${claims}`;
  // ES256 is a raw 64-byte r‖s pair. Node signs DER by default, which a push
  // service rejects with a 401 that says nothing useful.
  const signature = sign('sha256', Buffer.from(signingInput), {
    key: createPrivateKey({ key: toJwk(keys), format: 'jwk' }),
    dsaEncoding: 'ieee-p1363',
  });

  return `vapid t=${signingInput}.${toBase64Url(signature)}, k=${keys.publicKey}`;
}

/**
 * The configured keys, or null.
 *
 * Null is a supported state, not a broken one: with no keys the whole feature
 * is inert and the UI never offers it, so a deploy that has not been given
 * keys behaves exactly like the app did before push existed.
 */
export function vapidKeys(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
