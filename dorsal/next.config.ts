import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The repository root holds an unrelated project with its own lockfile, so
  // Next has to be told where this app actually starts.
  outputFileTracingRoot: import.meta.dirname,
  eslint: { dirs: ['app', 'components', 'features', 'lib', 'scripts'] },
  // Supabase Storage is the only remote image source; avatars are served from
  // the project's own EU bucket. No third-party image CDN. 05-RGPD §1.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/**' }],
  },
};

export default config;
