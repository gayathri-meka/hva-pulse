/**
 * MCP client integration test.
 * Spawns the MCP server as a subprocess (stdio transport) and exercises both tools.
 *
 * Run with:
 *   npx tsx --env-file=../.env.local test-client.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', join(__dirname, 'server.ts')],
  env: {
    ...process.env,
    MCP_DATABASE_URL: process.env.MCP_DATABASE_URL!,
  },
});

const client = new Client({ name: 'pulse-mcp-test', version: '1.0.0' });

await client.connect(transport);
console.log('Connected to pulse-mcp server\n');

// ── 1. get_schema ─────────────────────────────────────────────────────────
console.log('=== get_schema ===');
const schemaResult = await client.callTool({ name: 'get_schema', arguments: {} });
const schemaText = (schemaResult.content as { type: string; text: string }[])[0].text;
// Print first 800 chars so the output is readable
console.log(schemaText.slice(0, 800) + '\n... (truncated)\n');

// ── 2. execute_query ──────────────────────────────────────────────────────
console.log('=== execute_query: SELECT COUNT(*) FROM applications ===');
const queryResult = await client.callTool({
  name: 'execute_query',
  arguments: { sql: 'SELECT COUNT(*) FROM applications' },
});
console.log((queryResult.content as { type: string; text: string }[])[0].text);

await client.close();
