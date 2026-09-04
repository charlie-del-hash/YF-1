/**
 * Prints a VAPID keypair. `pnpm push:keys`, once, then paste into the
 * environment. The private key is a signing key: it belongs in the server-side
 * environment only, never in a NEXT_PUBLIC_ variable.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const b = (v) => Buffer.from(v, 'base64url');

const uncompressed = Buffer.concat([Buffer.from([0x04]), b(jwk.x), b(jwk.y)]);

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${uncompressed.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${b(jwk.d).toString('base64url')}`);
console.log('VAPID_SUBJECT=mailto:hola@example.com   # a real address you read');
console.log('');
console.log('The public key is safe in the browser. The private key is not:');
console.log('server-side environment only, and never in a NEXT_PUBLIC_ variable.');
void publicKey;
