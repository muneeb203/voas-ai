import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // In dev the service worker just gets in the way (stale caches); only build it
  // for production. Test the installable app with `pnpm build && pnpm start`.
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // typedRoutes disabled — we have intentional placeholder routes (/legal/*).
  // Re-enable once those pages exist.
};

export default withSerwist(withNextIntl(nextConfig));
