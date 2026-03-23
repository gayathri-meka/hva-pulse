/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tree-shake large packages so only used exports end up in the client bundle.
    optimizePackageImports: [
      '@tanstack/react-table',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
}

export default nextConfig
