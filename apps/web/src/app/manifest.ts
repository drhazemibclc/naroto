import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Naroto Pediatric Clinic',
    short_name: 'Naroto',
    description: 'Advanced pediatric clinic management system.',
    start_url: '/dashboard', // Changed from /new to /dashboard
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9', // Example: a medical blue color
    icons: [
      {
        src: '/favicon/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/favicon/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
}
