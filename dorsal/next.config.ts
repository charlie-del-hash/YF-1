import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  eslint: { dirs: ['app', 'components', 'features', 'lib', 'scripts'] },
  // Supabase Storage is the only remote image source; avatars are served from
  // the project's own EU bucket. No third-party image CDN. 05-RGPD §1.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/**' }],
  },
};

export default config;
