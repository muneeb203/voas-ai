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

module.exports = nextConfig;
