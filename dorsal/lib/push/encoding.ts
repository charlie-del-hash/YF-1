/** base64url, both directions. Every key and secret in Web Push arrives as one. */
export function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function toBase64Url(value: Buffer): string {
  return value.toString('base64url');
}
