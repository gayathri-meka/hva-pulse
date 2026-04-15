import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { runBigQuery } from '../lib/bigquery'

const BILLING_PROJECT = 'hyperverge-chabtbot'
const DATA_PROJECT    = 'sensai-441917'

// Find gradual improvement patterns (2→3→4 or 1→2→3→4) across all learners
const QUERY = `
WITH ranked AS (
  SELECT
    email, learner_name, course_name, question_title, question_id,
    score, max_score, passed, attempt_at,
    ROW_NUMBER() OVER (PARTITION BY email, question_id ORDER BY attempt_at ASC) AS attempt_num,
    COUNT(*) OVER (PARTITION BY email, question_id) AS total_attempts
  FROM \`${DATA_PROJECT}.sensai_prod.pulse_task_question_attempts\`
  WHERE question_type = 'subjective'
    AND course_name IN ('Coding in Python', 'Web Development')
),
progressions AS (
  SELECT
    email, learner_name, course_name, question_title, total_attempts,
    STRING_AGG(
      CAST(CAST(score AS INT64) AS STRING) || '/' || CAST(CAST(max_score AS INT64) AS STRING),
      ' -> ' ORDER BY attempt_num
    ) AS prog
  FROM ranked
  WHERE total_attempts >= 3
  GROUP BY email, learner_name, course_name, question_title, total_attempts
)
SELECT learner_name, course_name, question_title, total_attempts, prog
FROM progressions
WHERE (
  -- Gradual: each score is >= previous (monotonically increasing)
  prog LIKE '1/4 -> 2/4%'
  OR prog LIKE '1/4 -> 3/4%'
  OR prog LIKE '2/4 -> 3/4 -> 4/4%'
  OR prog LIKE '1/4 -> 2/4 -> 3/4%'
  OR prog LIKE '1/4 -> 2/4 -> 4/4%'
)
ORDER BY total_attempts DESC
LIMIT 20
`

async function main() {
  const rows = await runBigQuery(BILLING_PROJECT, QUERY)
  console.log('[bq] ' + rows.length + ' rows')
  for (const row of rows) {
    console.log(row.learner_name + ' | ' + row.course_name + ' | ' + row.question_title)
    console.log('  ' + row.prog + ' (' + row.total_attempts + ' attempts)')
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
