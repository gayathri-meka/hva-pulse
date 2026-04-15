'use server'

import { requireStaff } from '@/lib/auth'
import { runBigQuery } from '@/lib/bigquery'

const BQ_BILLING = 'hyperverge-chabtbot'
const BQ_DATA    = 'sensai-441917'

export type ChatMessage = {
  role:    'user' | 'assistant'
  content: string
  score:   string | null
  feedback_correct: string | null
  feedback_wrong:   string | null
  timestamp: string
}

/** Fetch the full chat thread for a specific learner + question from BigQuery. */
export async function fetchQuestionThread(
  email: string,
  questionTitle: string,
  courseName: string,
): Promise<ChatMessage[]> {
  await requireStaff()

  const q = `
    WITH u AS (
      SELECT id FROM \`${BQ_DATA}.sensai_prod.users\`
      WHERE created_at >= TIMESTAMP('2020-01-01')
        AND LOWER(TRIM(email)) = '${email.toLowerCase().replace(/'/g, "\\'")}'
      GROUP BY id LIMIT 1
    ),
    q AS (
      SELECT id AS question_id FROM \`${BQ_DATA}.sensai_prod.questions\`
      WHERE created_at >= TIMESTAMP('2020-01-01')
        AND LOWER(TRIM(title)) = '${questionTitle.toLowerCase().replace(/'/g, "\\'")}'
        AND task_id IN (
          SELECT task_id FROM \`${BQ_DATA}.sensai_prod.course_tasks\`
          WHERE created_at >= TIMESTAMP('2020-01-01')
            AND course_id IN (
              SELECT id FROM \`${BQ_DATA}.sensai_prod.courses\`
              WHERE created_at >= TIMESTAMP('2020-01-01')
                AND org_id = 4
                AND LOWER(TRIM(name)) = '${courseName.toLowerCase().replace(/'/g, "\\'")}'
              GROUP BY id
            )
        )
      GROUP BY id LIMIT 1
    )
    SELECT DISTINCT
      ch.role,
      ch.created_at AS timestamp,
      ch.content
    FROM \`${BQ_DATA}.sensai_prod.chat_history\` ch
    WHERE ch.created_at >= TIMESTAMP('2024-01-01')
      AND ch.user_id = (SELECT id FROM u)
      AND ch.question_id = (SELECT question_id FROM q)
    ORDER BY ch.created_at ASC
  `

  const rows = await runBigQuery(BQ_BILLING, q)

  return rows.map((row) => {
    const role = row.role as 'user' | 'assistant'
    let content = row.content ?? ''
    let score: string | null = null
    let feedbackCorrect: string | null = null
    let feedbackWrong: string | null = null

    if (role === 'assistant') {
      try {
        const parsed = JSON.parse(content)
        content = parsed.feedback ?? content
        const sc = parsed.scorecard?.[0]
        if (sc) {
          score = sc.score + '/' + sc.max_score
          feedbackCorrect = sc.feedback?.correct ?? null
          feedbackWrong = sc.feedback?.wrong ?? null
        }
      } catch {
        // content stays as-is if not valid JSON
      }
    }

    return {
      role,
      content,
      score,
      feedback_correct: feedbackCorrect,
      feedback_wrong:   feedbackWrong,
      timestamp:        row.timestamp ?? '',
    }
  })
}
