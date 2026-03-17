import pg from 'pg';

const { Pool } = pg;

if (!process.env.MCP_DATABASE_URL) {
  throw new Error('MCP_DATABASE_URL environment variable is required');
}

// pulse_mcp_ro is a SELECT-only role at the DB level.
// validators.ts is a second layer on top.
const pool = new Pool({
  connectionString: process.env.MCP_DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  process.stderr.write(`[pulse-mcp] pool error: ${err.message}\n`);
});

export async function executeQuery(
  sql: string,
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 10000'); // 10 s hard cap
    const result = await client.query(sql);
    return {
      rows: result.rows as Record<string, unknown>[],
      columns: result.fields.map((f) => f.name),
    };
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
