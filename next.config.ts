import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to successfully complete even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  experimental: {
    ppr: true,
    // Hint next-intl/plugin to use experimental.turbo instead of top-level `turbopack`
    turbo: {},
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
};
// Enable next-intl plugin in all environments to ensure consistent behavior
// Use default request config path (./i18n/request.ts or ./src/i18n/request.ts)
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
