/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @tanstack/react-table has a proper exports map — safe to tree-shake.
    // @dnd-kit/* does NOT have an exports map so must NOT be listed here.
    optimizePackageImports: ['@tanstack/react-table'],
  },
  // Include the MCP server and its node_modules in the Vercel function bundle
  // for the ask-pulse API route (which spawns mcp/dist/server.js as a subprocess).
  outputFileTracingIncludes: {
    '/api/ask-pulse': ['./mcp/dist/**/*', './mcp/node_modules/**/*'],
  },
}

export default nextConfig
