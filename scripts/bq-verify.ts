/**
 * BigQuery view verifier — read-only.
 *
 * Pulse-managed views in sensai_prod are applied manually via the BQ console
 * (we don't grant the pulse-sync service account write access). This script
 * checks that the expected views exist and reports row counts so you can tell
 * if a migration was applied successfully.
 *
 * Usage:
 *   npx tsx scripts/bq-verify.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { runBigQuery } from '../lib/bigquery'

const BILLING_PROJECT = 'hyperverge-chabtbot'
const DATA_PROJECT    = 'sensai-441917'
const DATASET         = 'sensai_prod'

const VIEWS = [
  'pulse_task_question_attempts',
  'pulse_task_completion_status',
  'pulse_weekly_completion',
]

async function main() {
  for (const view of VIEWS) {
    process.stdout.write(`  • ${view} ... `)
    try {
      const rows = await runBigQuery(
        BILLING_PROJECT,
        `SELECT COUNT(*) AS n FROM \`${DATA_PROJECT}.${DATASET}.${view}\``,
      )
      const n = rows[0]?.n ?? '0'
      console.log(`OK (${n} rows)`)
    } catch (e) {
      console.log('MISSING or BROKEN')
      console.error(`     ${(e as Error).message}`)
    }
  }
}

main().catch((e) => {
  console.error('[bq-verify] FAILED:', e)
  process.exit(1)
})
