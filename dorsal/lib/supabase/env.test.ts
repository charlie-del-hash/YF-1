import { afterEach, describe, expect, it } from 'vitest';
import { siteUrl } from './env';

const KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_VERCEL_URL',
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

/**
 * The first deploy used to fail here: NEXT_PUBLIC_SITE_URL cannot be known
 * before the first deploy exists, so it was always wrong the first time, and a
 * wrong value makes every sign-in link look expired with nothing in any log.
 */
describe('siteUrl', () => {
  it('falls back to localhost in development', () => {
    expect(siteUrl()).toBe('http://localhost:3000');
  });

  it('uses the stable production domain when Vercel provides one', () => {
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'dorsal.vercel.app';
    expect(siteUrl()).toBe('https://dorsal.vercel.app');
  });

  it('prefers the stable domain over the per-deployment one', () => {
    // A per-deployment address changes every push and can never be on the
    // Supabase redirect allow-list, so it must never win.
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'dorsal.vercel.app';
    process.env.NEXT_PUBLIC_VERCEL_URL = 'dorsal-abc123-charlie.vercel.app';
    expect(siteUrl()).toBe('https://dorsal.vercel.app');
  });

  it('an explicit setting beats both, which is how a custom domain works', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://dorsal.es';
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = 'dorsal.vercel.app';
    expect(siteUrl()).toBe('https://dorsal.es');
  });

  it('tolerates a trailing slash, which is how people paste URLs', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://dorsal.es/';
    expect(siteUrl()).toBe('https://dorsal.es');
  });
});
