import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { closePool } from './lib/db.js';
import { registerQueryTool } from './tools/query.js';
import { registerSchemaTool } from './tools/schema.js';

const server = new McpServer({
  name: 'pulse-db',
  version: '1.0.0',
});

registerSchemaTool(server);
registerQueryTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write('[pulse-mcp] server ready (stdio)\n');

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});
