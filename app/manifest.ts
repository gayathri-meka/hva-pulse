import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HVA Pulse',
    short_name: 'Pulse',
    description: 'Learner placements platform',
    start_url: '/learner',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#18181b',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
