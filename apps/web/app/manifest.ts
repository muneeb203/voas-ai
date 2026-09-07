import type { MetadataRoute } from 'next';

// Next generates /manifest.webmanifest from this and auto-links it in <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'VOAS AI',
    short_name: 'VOAS',
    description: 'Manage your VOAS AI front desk — orders, bookings, and conversations.',
    // Installed app opens straight into the dashboard (redirects to login if needed).
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A2540',
    theme_color: '#0A2540',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
