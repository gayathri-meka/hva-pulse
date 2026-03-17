/**
 * Verifies that the pulse_mcp_ro role enforces read-only access at the DB level.
 * Run with: MCP_DATABASE_URL=... npx tsx test-db-perms.ts
 * Or:       npx tsx --env-file=../.env.local test-db-perms.ts
 */

import pg from 'pg';

const { Client } = pg;

const url = process.env.MCP_DATABASE_URL;
if (!url) {
  console.error('MCP_DATABASE_URL is not set');
  process.exit(1);
}

type TestResult = { label: string; expected: 'pass' | 'fail'; outcome: 'pass' | 'fail'; detail: string };

async function run(client: pg.Client, sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await client.query(sql);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    // Force IPv4 — Supabase direct host resolves to IPv6 which can time out
    // from machines without proper IPv6 routing.
    // @ts-expect-error pg types don't expose family but node net.connect accepts it
    family: 4,
  });

  await client.connect();
  console.log('Connected as:', (await client.query('SELECT current_user')).rows[0].current_user);
  console.log('');

  const results: TestResult[] = [];

  const test = async (label: string, sql: string, expected: 'pass' | 'fail') => {
    const { ok, error } = await run(client, sql);
    const outcome: 'pass' | 'fail' = ok ? 'pass' : 'fail';
    results.push({ label, expected, outcome, detail: error ?? 'ok' });
  };

  // ── Reads — should all succeed ──────────────────────────────────────────
  await test('SELECT from users',        'SELECT id, email, role FROM users LIMIT 1',          'pass');
  await test('SELECT from learners',     'SELECT user_id FROM learners LIMIT 1',               'pass');
  await test('SELECT from companies',    'SELECT id, company_name FROM companies LIMIT 1',     'pass');
  await test('SELECT from roles',        'SELECT id, role_title FROM roles LIMIT 1',           'pass');
  await test('SELECT from applications', 'SELECT id, status FROM applications LIMIT 1',        'pass');
  await test('SELECT from alumni',       'SELECT id, name FROM alumni LIMIT 1',                'pass');

  // ── Writes — should all be denied ───────────────────────────────────────
  await test(
    'INSERT into users',
    `INSERT INTO users (email, role, name) VALUES ('mcp-test@example.com', 'learner', 'Test')`,
    'fail',
  );
  await test(
    'UPDATE users',
    `UPDATE users SET name = 'hacked' WHERE email = 'mcp-test@example.com'`,
    'fail',
  );
  await test(
    'DELETE from users',
    `DELETE FROM users WHERE email = 'mcp-test@example.com'`,
    'fail',
  );
  await test(
    'TRUNCATE companies',
    'TRUNCATE companies',
    'fail',
  );
  await test(
    'DROP TABLE (companies)',
    'DROP TABLE companies',
    'fail',
  );
  await test(
    'CREATE TABLE',
    'CREATE TABLE mcp_test_table (id int)',
    'fail',
  );
  await test(
    'ALTER TABLE',
    `ALTER TABLE users ADD COLUMN mcp_hack text`,
    'fail',
  );

  // ── Print results ────────────────────────────────────────────────────────
  console.log('Results:');
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const ok = r.outcome === r.expected;
    const icon = ok ? '✓' : '✗';
    const tag  = r.expected === 'pass' ? '[read]' : '[write]';
    console.log(`  ${icon} ${tag} ${r.label}`);
    if (!ok) {
      console.log(`      expected=${r.expected} got=${r.outcome} — ${r.detail}`);
      failed++;
    } else {
      passed++;
    }
  }

  console.log(`\n${passed}/${results.length} passed${failed ? ` — ${failed} UNEXPECTED` : ''}`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
