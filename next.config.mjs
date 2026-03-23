/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @tanstack/react-table has a proper exports map — safe to tree-shake.
    // @dnd-kit/* does NOT have an exports map so must NOT be listed here.
    optimizePackageImports: ['@tanstack/react-table'],
  },
}

export default nextConfig
