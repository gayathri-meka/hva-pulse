import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve relative to mcp/ regardless of whether we're running from src or dist
const SCHEMA_PATH = join(__dirname, '../../docs/schema.sql');

export function registerSchemaTool(server: McpServer): void {
  server.tool(
    'get_schema',
    'Returns the full Pulse database schema: all table definitions, column names, types, ' +
      'constraints, and foreign-key relationships. ' +
      'Call this before writing any SQL query to ensure you use the correct table and column names.',
    {},
    async () => {
      const schema = await readFile(SCHEMA_PATH, 'utf-8');
      return {
        content: [{ type: 'text', text: schema }],
      };
    },
  );
}
