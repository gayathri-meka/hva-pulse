import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeQuery } from '../lib/db.js';
import { enforceLimit, validateQuery } from '../lib/validators.js';

export function registerQueryTool(server: McpServer): void {
  server.tool(
    'execute_query',
    'Execute a read-only SQL SELECT query against the Pulse database. ' +
      'Returns up to 200 rows as JSON. ' +
      'Query must start with SELECT or WITH — any mutation keywords are rejected before execution.',
    {
      sql: z.string().describe(
        'A read-only SQL SELECT (or WITH … SELECT) query against the Pulse database. ' +
          'No INSERT / UPDATE / DELETE / DROP / ALTER or other mutations allowed.',
      ),
    },
    async ({ sql }) => {
      try {
        validateQuery(sql);
        const safeSql = enforceLimit(sql, 200);
        const { rows, columns } = await executeQuery(safeSql);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ columns, rowCount: rows.length, rows }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
