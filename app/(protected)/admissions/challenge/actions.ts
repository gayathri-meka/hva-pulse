'use server'

import { requireStaff } from '@/lib/auth'
import { runBigQuery } from '@/lib/bigquery'
import {
  toChatMessage,
  blocksToText,
  parseScorecardCriteria,
  type ChatMessage,
  type ScorecardCategory,
} from '@/lib/sensaiChat'

const BQ_BILLING = 'hyperverge-chabtbot'
const BQ_DATA = 'sensai-441917'

// Note: questions belong to exactly one course/task, so filtering chat_history by
// question_id (or task_id) already scopes a query to this challenge course (587,
// HVA Screening 2026 / cohort 214) — no extra cohort join is needed.

const esc = (s: string) => s.replace(/'/g, "\\'")
function intParam(v: string | number, label: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ${label}: ${v}`)
  return n
}

export type TaskQuestion = {
  questionId: string
  title: string
  type: string // 'objective' | 'subjective'
  position: number
}

/** The questions (sub-tasks) of a quiz task, in display order. */
export async function getTaskQuestions(taskId: string): Promise<TaskQuestion[]> {
  await requireStaff()
  const tid = intParam(taskId, 'taskId')

  const sql = `
    SELECT id AS question_id, ANY_VALUE(title) AS title, ANY_VALUE(type) AS type,
           ANY_VALUE(position) AS position
    FROM \`${BQ_DATA}.sensai_prod.questions\`
    WHERE created_at >= TIMESTAMP('2020-01-01')
      AND deleted_at IS NULL
      AND task_id = ${tid}
    GROUP BY id
    ORDER BY position, question_id
  `
  const rows = await runBigQuery(BQ_BILLING, sql)
  return rows.map((r) => ({
    questionId: r.question_id ?? '',
    title: r.title ?? 'Question',
    type: r.type ?? '',
    position: Number(r.position ?? 0),
  }))
}

export type LearnerQuestionThread = TaskQuestion & {
  description: string
  scorecard: ScorecardCategory[]
  messages: ChatMessage[]
}

/**
 * Feature 1 — one learner's progression across every question in a task.
 * Returns all the task's questions (even unattempted) with that learner's full
 * chat thread per question, chronological. Drives the per-question score
 * progression badges + the conversation modal.
 */
export async function getLearnerTaskDetail(
  email: string,
  taskId: string,
): Promise<LearnerQuestionThread[]> {
  await requireStaff()
  const tid = intParam(taskId, 'taskId')

  const sql = `
    WITH u AS (
      SELECT id FROM \`${BQ_DATA}.sensai_prod.users\`
      WHERE created_at >= TIMESTAMP('2020-01-01')
        AND LOWER(TRIM(email)) = '${esc(email.toLowerCase().trim())}'
      GROUP BY id LIMIT 1
    ),
    qs AS (
      SELECT q.id AS question_id, ANY_VALUE(q.title) AS title, ANY_VALUE(q.type) AS type,
             ANY_VALUE(q.position) AS position, ANY_VALUE(q.blocks) AS blocks,
             ANY_VALUE(sc.criteria) AS criteria
      FROM \`${BQ_DATA}.sensai_prod.questions\` q
      LEFT JOIN \`${BQ_DATA}.sensai_prod.question_scorecards\` qsc
        ON qsc.question_id = q.id AND qsc.created_at >= TIMESTAMP('2020-01-01')
      LEFT JOIN \`${BQ_DATA}.sensai_prod.scorecards\` sc
        ON sc.id = qsc.scorecard_id AND sc.created_at >= TIMESTAMP('2020-01-01')
      WHERE q.created_at >= TIMESTAMP('2020-01-01')
        AND q.deleted_at IS NULL
        AND q.task_id = ${tid}
      GROUP BY q.id
    )
    SELECT DISTINCT
      qs.question_id, qs.title, qs.type, qs.position, qs.blocks, qs.criteria,
      ch.role, ch.content, ch.created_at AS ts
    FROM qs
    CROSS JOIN u
    LEFT JOIN \`${BQ_DATA}.sensai_prod.chat_history\` ch
      ON ch.question_id = qs.question_id
      AND ch.user_id = u.id
      AND ch.created_at >= TIMESTAMP('2024-01-01')
    ORDER BY qs.position, qs.question_id, ch.created_at
  `
  const rows = await runBigQuery(BQ_BILLING, sql)

  const byQ = new Map<string, LearnerQuestionThread>()
  for (const r of rows) {
    const qid = r.question_id ?? ''
    if (!byQ.has(qid)) {
      byQ.set(qid, {
        questionId: qid,
        title: r.title ?? 'Question',
        type: r.type ?? '',
        position: Number(r.position ?? 0),
        description: blocksToText(r.blocks ?? null),
        scorecard: parseScorecardCriteria(r.criteria ?? null),
        messages: [],
      })
    }
    if (r.role) byQ.get(qid)!.messages.push(toChatMessage(r.role, r.content, r.ts))
  }
  return [...byQ.values()].sort((a, b) => a.position - b.position)
}

export type QuestionAnswer = {
  email: string
  name: string
  answer: string // learner's submitted content
  score: string | null
  correct: boolean | null
  feedback: string | null
  at: string // ISO
}

export type QuestionDetail = {
  title: string
  type: string
  description: string // plain text extracted from the question's BlockNote prompt
  scorecard: ScorecardCategory[]
  answers: QuestionAnswer[]
}

/**
 * Feature 2 — recent answers a single question got from ALL learners.
 * Pairs each learner submission with its grader response; returns every attempt
 * (re-attempts included), newest first.
 */
export async function getQuestionAnswers(
  questionId: string,
  limit = 100,
): Promise<QuestionDetail> {
  await requireStaff()
  const qid = intParam(questionId, 'questionId')

  // Question prompt + rubric. LEFT JOIN the (deduped) scorecard for this question.
  const metaSql = `
    SELECT
      ANY_VALUE(q.title) AS title,
      ANY_VALUE(q.type) AS type,
      ANY_VALUE(q.blocks) AS blocks,
      ANY_VALUE(sc.criteria) AS criteria
    FROM \`${BQ_DATA}.sensai_prod.questions\` q
    LEFT JOIN \`${BQ_DATA}.sensai_prod.question_scorecards\` qsc
      ON qsc.question_id = q.id AND qsc.created_at >= TIMESTAMP('2020-01-01')
    LEFT JOIN \`${BQ_DATA}.sensai_prod.scorecards\` sc
      ON sc.id = qsc.scorecard_id AND sc.created_at >= TIMESTAMP('2020-01-01')
    WHERE q.created_at >= TIMESTAMP('2020-01-01') AND q.id = ${qid}
  `
  const chatSql = `
    SELECT DISTINCT
      ch.user_id, ch.role, ch.content, ch.created_at AS ts,
      LOWER(TRIM(usr.email)) AS email,
      TRIM(CONCAT(COALESCE(usr.first_name, ''), ' ', COALESCE(usr.last_name, ''))) AS name
    FROM \`${BQ_DATA}.sensai_prod.chat_history\` ch
    JOIN \`${BQ_DATA}.sensai_prod.users\` usr
      ON usr.id = ch.user_id AND usr.created_at >= TIMESTAMP('2020-01-01')
    WHERE ch.created_at >= TIMESTAMP('2024-01-01')
      AND ch.question_id = ${qid}
    ORDER BY ch.user_id, ts
  `
  const [metaRows, rows] = await Promise.all([
    runBigQuery(BQ_BILLING, metaSql),
    runBigQuery(BQ_BILLING, chatSql),
  ])
  const meta = metaRows[0]
  const title = meta?.title ?? 'Question'
  const description = blocksToText(meta?.blocks ?? null)
  const scorecard = parseScorecardCriteria(meta?.criteria ?? null)
  const type = meta?.type ?? ''

  // Walk each learner's rows in time order, pairing a user submission with the
  // next assistant grade → one attempt.
  type Row = { user_id: string; role: string; content: string | null; ts: unknown; email: string; name: string }
  const byUser = new Map<string, Row[]>()
  for (const r of rows as unknown as Row[]) {
    const k = r.user_id ?? ''
    if (!byUser.has(k)) byUser.set(k, [])
    byUser.get(k)!.push(r)
  }

  const answers: QuestionAnswer[] = []
  for (const [, list] of byUser) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].role !== 'user') continue
      const userRow = list[i]
      const next = list[i + 1]?.role === 'assistant' ? list[i + 1] : null
      const graded = next ? toChatMessage('assistant', next.content, next.ts) : null
      answers.push({
        email: userRow.email ?? '',
        name: userRow.name?.trim() || userRow.email || 'Learner',
        answer: userRow.content ?? '',
        score: graded?.score ?? null,
        correct: graded?.correct ?? null,
        feedback: graded?.content ?? null,
        at: toChatMessage('user', null, userRow.ts).timestamp,
      })
    }
  }

  answers.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return { title, type, description, scorecard, answers: answers.slice(0, limit) }
}
