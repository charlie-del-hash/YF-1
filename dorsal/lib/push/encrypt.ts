import { createCipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
import { fromBase64Url } from './encoding';

/**
 * Web Push payload encryption: RFC 8291 over the `aes128gcm` content encoding
 * of RFC 8188.
 *
 * Written out rather than pulled from `web-push`, because CLAUDE.md's stack
 * table says a dependency is a data-protection question before it is a
 * bundle-size one — and this one would sit in the path of every message the
 * product sends. It is about sixty lines of standard library, it is the part
 * that must be exactly right, and being ours means it can be tested against
 * the RFC's own vector instead of trusted.
 *
 * The push service never sees any of this: it forwards ciphertext it cannot
 * read to a browser that holds the only key. That is the whole point of the
 * scheme, and it is why a push endpoint is a smaller disclosure than it looks.
 */

/** RFC 8188 record size. One record is plenty for a notification. */
const RECORD_SIZE = 4096;

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

/** HKDF with a single-block expand, which is all this scheme ever needs. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

export interface PushKeys {
  /** The subscription's `p256dh`: the browser's public key, base64url. */
  p256dh: string;
  /** The subscription's `auth` secret, base64url. */
  auth: string;
}

/** Everything the encryption needs to be reproducible, for the tests. */
export interface EncryptOptions {
  salt?: Buffer;
  /** A 32-byte P-256 private scalar for the ephemeral key. */
  ephemeralPrivate?: Buffer;
}

export function encryptPayload(
  payload: string | Buffer,
  keys: PushKeys,
  options: EncryptOptions = {},
): Buffer {
  const uaPublic = fromBase64Url(keys.p256dh);
  const authSecret = fromBase64Url(keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('bad_p256dh');
  if (authSecret.length !== 16) throw new Error('bad_auth');

  const ecdh = createECDH('prime256v1');
  if (options.ephemeralPrivate) ecdh.setPrivateKey(options.ephemeralPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const salt = options.salt ?? randomBytes(16);

  // RFC 8291 §3.4. The two public keys are in the info string, which is what
  // binds the derived key to this exact pair and stops a replay against
  // another subscription.
  const ikm = hkdf(
    authSecret,
    sharedSecret,
    Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]),
    32,
  );

  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  // 0x02 is the RFC 8188 delimiter for the last record. Getting this wrong
  // produces a notification the browser silently drops.
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]);
  if (plaintext.length + 16 > RECORD_SIZE) throw new Error('payload_too_long');

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);

  return Buffer.concat([header, asPublic, ciphertext]);
}
