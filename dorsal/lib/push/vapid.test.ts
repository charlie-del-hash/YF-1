import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { vapidAuthorization, type VapidKeys } from './vapid';

/**
 * VAPID is how a push service decides whether to accept the request at all. A
 * bad signature comes back as a 401 that says nothing useful, so the checks
 * here are the ones that cost an afternoon otherwise: the signature is raw
 * r‖s rather than DER, and the audience is the endpoint's origin rather than
 * the endpoint.
 */
function freshKeys(): VapidKeys & { publicKeyObject: ReturnType<typeof createPublicKey> } {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' }) as { x: string; y: string; d: string };
  const b = (v: string) => Buffer.from(v, 'base64url');
  return {
    publicKey: Buffer.concat([Buffer.from([0x04]), b(jwk.x), b(jwk.y)]).toString('base64url'),
    privateKey: b(jwk.d).toString('base64url'),
    subject: 'mailto:hola@dorsal.test',
    publicKeyObject: createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
      format: 'jwk',
    }),
  };
}

const decodeClaims = (header: string) => {
  const token = header.slice('vapid t='.length).split(',')[0]!;
  return JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
};

describe('the VAPID authorization header', () => {
  const keys = freshKeys();
  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123?query=1';

  it('names the origin as the audience, never the endpoint', () => {
    const claims = decodeClaims(vapidAuthorization(endpoint, keys));
    // The endpoint identifies one person's browser. It has no business being
    // inside a signed claim, and a push service rejects it anyway.
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.aud).not.toContain('abc123');
  });

  it('expires, and well inside the 24 hours the RFC allows', () => {
    const now = Date.UTC(2026, 0, 1);
    const claims = decodeClaims(vapidAuthorization(endpoint, keys, now));
    const seconds = claims.exp - Math.floor(now / 1000);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(24 * 60 * 60);
  });

  it('signs with ES256 as a raw r‖s pair, which is what verifies', () => {
    const header = vapidAuthorization(endpoint, keys);
    const token = header.slice('vapid t='.length).split(',')[0]!;
    const [h, c, signature] = token.split('.');
    expect(
      verify(
        'sha256',
        Buffer.from(`${h}.${c}`),
        { key: keys.publicKeyObject, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature!, 'base64url'),
      ),
    ).toBe(true);
  });

  it('hands the push service the public key it should check against', () => {
    expect(vapidAuthorization(endpoint, keys)).toContain(`k=${keys.publicKey}`);
  });

  it('refuses keys that are not a P-256 pair', () => {
    expect(() => vapidAuthorization(endpoint, { ...keys, privateKey: 'c2hvcnQ' })).toThrow(
      'bad_vapid_private_key',
    );
    expect(() => vapidAuthorization(endpoint, { ...keys, publicKey: 'c2hvcnQ' })).toThrow(
      'bad_vapid_public_key',
    );
  });
});
