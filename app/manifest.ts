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
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
