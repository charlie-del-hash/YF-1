import { describe, expect, it } from 'vitest';
import { photoPathSchema } from './schema';

/**
 * The column is called `photo_url` and holds a path. That mismatch is exactly
 * the kind of thing that gets "fixed" later by someone validating it as a URL,
 * so the reason it must not be one is written down as a test.
 */
describe('a profile photo is a path in our own private bucket', () => {
  const id = '3f1b8c2a-9d4e-4f7a-8b1c-2d3e4f5a6b7c';

  it('accepts the one shape we write', () => {
    expect(photoPathSchema.safeParse(`${id}/perfil`).success).toBe(true);
  });

  it('rejects a URL, which would make every render a request to someone else', () => {
    expect(photoPathSchema.safeParse('https://tracker.example/pixel.gif').success).toBe(false);
    expect(photoPathSchema.safeParse(`https://x/${id}/perfil`).success).toBe(false);
  });

  it('rejects a path that climbs out of the folder it is allowed in', () => {
    expect(photoPathSchema.safeParse(`${id}/../otro/perfil`).success).toBe(false);
    expect(photoPathSchema.safeParse(`../${id}/perfil`).success).toBe(false);
  });

  it('rejects another bucket, and another object in this one', () => {
    expect(photoPathSchema.safeParse(`${id}/selfie`).success).toBe(false);
    expect(photoPathSchema.safeParse(`verificaciones/${id}/selfie`).success).toBe(false);
  });

  it('rejects an empty path, which would read as "no photo" and is not', () => {
    expect(photoPathSchema.safeParse('').success).toBe(false);
    expect(photoPathSchema.safeParse('perfil').success).toBe(false);
  });
});
