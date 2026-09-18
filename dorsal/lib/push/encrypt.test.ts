import { createDecipheriv, createECDH, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptPayload } from './encrypt';

/**
 * Web Push payload encryption is the one piece of this product where "it
 * looked like it worked" is worth nothing: a mistake produces a notification
 * the browser silently drops, with no error anywhere. So the first test is the
 * published test vector from RFC 8291 §5 — same input, same output, byte for
 * byte. That is what makes writing this instead of taking a dependency
 * defensible.
 */
describe('RFC 8291 §5, the published example', () => {
  const uaPublic =
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const authSecret = 'BTBZMqHH6r4Tts7J_aSIgg';
  const asPrivate = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
  const salt = 'DGv6ra1nlYgDCS1FRnbzlw';
  const plaintext = 'When I grow up, I want to be a watermelon';
  const expected =
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS' +
    '6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qu' +
    'lcy4a-fN';

  it('produces the exact body in the RFC', () => {
    const body = encryptPayload(
      plaintext,
      { p256dh: uaPublic, auth: authSecret },
      {
        salt: Buffer.from(salt, 'base64url'),
        ephemeralPrivate: Buffer.from(asPrivate, 'base64url'),
      },
    );
    expect(body.toString('base64url')).toBe(expected);
  });
});

/** The receiver's half, written from RFC 8291 §3.4 so a round trip means something. */
function decrypt(body: Buffer, uaPrivate: Buffer, uaPublic: Buffer, authSecret: Buffer): string {
  const salt = body.subarray(0, 16);
  const keyLength = body.readUInt8(20);
  const asPublic = body.subarray(21, 21 + keyLength);
  const ciphertext = body.subarray(21 + keyLength);

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(uaPrivate);
  const shared = ecdh.computeSecret(asPublic);

  const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
  const hkdf = (s: Buffer, ikm: Buffer, info: Buffer, length: number) =>
    hmac(hmac(s, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length);

  const ikm = hkdf(
    authSecret,
    shared,
    Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]),
    32,
  );
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]);
  // The trailing 0x02 is RFC 8188's last-record delimiter.
  return plain.subarray(0, plain.length - 1).toString();
}

describe('a real subscription, round tripped', () => {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const keys = {
    p256dh: ua.getPublicKey().toString('base64url'),
    auth: Buffer.from('0123456789abcdef').toString('base64url'),
  };

  it('a browser holding the private key can read it back', () => {
    const message = JSON.stringify({ title: 'Tienes plaza', body: 'Se ha caído alguien.' });
    const body = encryptPayload(message, keys);
    expect(
      decrypt(body, ua.getPrivateKey(), ua.getPublicKey(), Buffer.from(keys.auth, 'base64url')),
    ).toBe(message);
  });

  it('is different every time, because the salt and the key are', () => {
    const a = encryptPayload('hola', keys);
    const b = encryptPayload('hola', keys);
    expect(a.equals(b)).toBe(false);
  });

  it('lays the header out as RFC 8188 says', () => {
    const body = encryptPayload('hola', keys);
    expect(body.readUInt32BE(16)).toBe(4096); // record size
    expect(body.readUInt8(20)).toBe(65); // key id length
    expect(body.subarray(21, 22)[0]).toBe(0x04); // uncompressed point
  });

  it('refuses a subscription whose keys are the wrong shape', () => {
    expect(() => encryptPayload('hola', { ...keys, auth: 'c2hvcnQ' })).toThrow('bad_auth');
    expect(() => encryptPayload('hola', { ...keys, p256dh: 'bm90LWEta2V5' })).toThrow('bad_p256dh');
  });

  it('refuses a payload that would not fit one record', () => {
    expect(() => encryptPayload('x'.repeat(4100), keys)).toThrow('payload_too_long');
  });
});
