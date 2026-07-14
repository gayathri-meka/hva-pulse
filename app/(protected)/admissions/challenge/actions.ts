'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/auth'
import { runBigQuery } from '@/lib/bigquery'
import { candidateRejectionReasons } from '@/lib/challengeReview'
import type { CriterionResult, SystemDecision, ReviewThresholds, CandidateSignals } from '@/lib/challengeReview'
import {
  toChatMessage,
  blocksToText,
  parseScorecardCriteria,
  type ChatMessage,
  type ScorecardCategory,
} from '@/lib/sensaiChat'
import {
  syncTableToSheet,
  getFirstTabName,
  parseSpreadsheetId,
  type SyncToSheetResult,
} from '@/lib/sheetSync'

// Generic "sync these rows to a sheet" — the client passes the rows + a
// serialisable column spec (header → field). Reusable by any surface.
export type SyncColumn = { header: string; field: string }

export async function syncRowsToSheet(params: {
  sheetUrl: string
  tab: string
  keyHeader: string
  keyField: string
  columns: SyncColumn[]
  rows: Record<string, unknown>[]
}): Promise<SyncToSheetResult> {
  await requireStaff()
  const id = parseSpreadsheetId(params.sheetUrl)
  if (!id) return { ok: false, error: 'Could not read a Google Sheet ID from that link.' }
  try {
    const tab = params.tab.trim() || (await getFirstTabName(id))
    const stats = await syncTableToSheet({
      spreadsheetId: id,
      sheetName: tab,
      rows: params.rows,
      keyHeader: params.keyHeader,
      key: (r) => String((r as Record<string, unknown>)[params.keyField] ?? ''),
      columns: params.columns.map((c) => ({
        header: c.header,
        value: (r: Record<string, unknown>) => { const v = r[c.field]; return v == null ? '' : String(v) },
      })),
    })
    return { ok: true, stats }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    if (/permission|PERMISSION_DENIED|403|does not have/i.test(msg))
      return { ok: false, error: 'Sync failed — make sure you shared the sheet with the service account as Editor.' }
    if (/parse range|not found|Requested entity/i.test(msg))
      return { ok: false, error: "Couldn't find that tab. Check the tab name, or leave it blank to use the first tab." }
    return { ok: false, error: msg }
  }
}

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

// ── Challenge review — the challenge→interview selection gate ────────────────

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type DecisionResult = { ok: true } | { ok: false; error: string }
type DecisionValue = 'selected' | 'rejected'

const normEmail = (e: string) => e.trim().toLowerCase()

/**
 * Record the team's verified verdict for one candidate. Upserts by
 * (email, cohort, course). Overriding the system's recommendation (verdict !=
 * system) requires a written reason. `systemDecision` + `criteriaSnapshot` are the
 * live values the reviewer saw — stored so rejection feedback is stable and we can
 * later flag when the system changes its mind vs this human verdict.
 */
export async function setChallengeDecision(input: {
  email: string
  cohortId: number
  courseId: number
  decision: DecisionValue
  reason?: string
  rejectionReasonType?: string
  rejectionMessage?: string
  systemDecision: SystemDecision
  criteriaSnapshot: CriterionResult[]
}): Promise<DecisionResult> {
  const user = await requireStaff()
  const email = normEmail(input.email)
  if (!email) return { ok: false, error: 'This candidate has no email to record a decision against.' }
  if (input.decision !== 'selected' && input.decision !== 'rejected')
    return { ok: false, error: 'Invalid decision.' }

  const overrode = input.decision !== input.systemDecision
  const reason = (input.reason ?? '').trim()
  if (overrode && !reason)
    return { ok: false, error: 'A reason is required when overriding the system recommendation.' }

  // Candidate-facing rejection message applies only to rejections.
  const rejecting = input.decision === 'rejected'
  const rejectionMessage = rejecting ? (input.rejectionMessage ?? '').trim() || null : null
  const rejectionReasonType = rejecting ? input.rejectionReasonType || null : null

  const now = new Date().toISOString()
  const { error } = await adminClient()
    .from('challenge_decisions')
    .upsert(
      {
        email,
        cohort_id: input.cohortId,
        course_id: input.courseId,
        final_decision: input.decision,
        reason: reason || null,
        rejection_reason_type: rejectionReasonType,
        rejection_message: rejectionMessage,
        overrode_system: overrode,
        system_decision_at_verify: input.systemDecision,
        criteria_snapshot: input.criteriaSnapshot,
        decided_by: user.id,
        decided_by_name: user.name,
        decided_at: now,
        updated_at: now,
      },
      { onConflict: 'email,cohort_id,course_id' },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/challenge')
  return { ok: true }
}

/**
 * Bulk-confirm the system's own verdict for many candidates at once (the queue-burn
 * path): each selected candidate is recorded EXACTLY as the system decided —
 * never an override. Overrides (which need a reason) go through the drawer one at
 * a time. Mixed selections are fine; each row confirms to its own system decision.
 */
export async function bulkConfirmChallengeDecisions(input: {
  cohortId: number
  courseId: number
  items: { email: string; name?: string; signals?: CandidateSignals; systemDecision: SystemDecision; criteriaSnapshot: CriterionResult[] }[]
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const user = await requireStaff()

  const now = new Date().toISOString()
  const rows = input.items
    // 'review'/'in_progress' aren't confirmable verdicts — skip them (review needs a
    // human; in_progress hasn't finished the challenge).
    .filter((it) => normEmail(it.email) && it.systemDecision !== 'review' && it.systemDecision !== 'in_progress')
    .map((it) => {
      // Auto-pick the most-relevant rejection message for rejected rows.
      const reject = it.systemDecision === 'rejected'
      const reasons = reject && it.signals ? candidateRejectionReasons(it.criteriaSnapshot, { name: it.name ?? '', signals: it.signals }) : []
      const top = reasons[0] // most relevant (or the 'general' fallback)
      return {
        email: normEmail(it.email),
        cohort_id: input.cohortId,
        course_id: input.courseId,
        final_decision: it.systemDecision,
        reason: null,
        rejection_reason_type: reject ? (top?.key ?? null) : null,
        rejection_message: reject ? (top?.message ?? null) : null,
        overrode_system: false,
        system_decision_at_verify: it.systemDecision,
        criteria_snapshot: it.criteriaSnapshot,
        decided_by: user.id,
        decided_by_name: user.name,
        decided_at: now,
        updated_at: now,
      }
    })

  if (rows.length === 0) return { ok: false, error: 'Nothing to confirm — these candidates need a manual decision.' }

  const { error } = await adminClient()
    .from('challenge_decisions')
    .upsert(rows, { onConflict: 'email,cohort_id,course_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/challenge')
  return { ok: true, count: rows.length }
}

/**
 * Release (or un-release) verified decisions to the candidate portal. A decision
 * is recorded internally on select/reject, but the candidate only sees it once
 * released. Only rows that HAVE a final_decision are affected.
 */
export async function releaseChallengeDecisions(input: {
  cohortId: number
  courseId: number
  emails: string[]
  publish: boolean
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireStaff()
  const emails = [...new Set(input.emails.map(normEmail).filter(Boolean))]
  if (!emails.length) return { ok: false, error: 'No candidates selected.' }

  const { data, error } = await adminClient()
    .from('challenge_decisions')
    .update({
      published_at: input.publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('cohort_id', input.cohortId)
    .eq('course_id', input.courseId)
    .in('email', emails)
    .not('final_decision', 'is', null) // can't release something that isn't decided
    .select('email')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/challenge')
  return { ok: true, count: data?.length ?? 0 }
}

/**
 * Undo a recorded decision — send the candidate(s) back to Pending. Deletes the
 * challenge_decisions row(s), which also clears any release (published_at).
 */
export async function clearChallengeDecisions(input: {
  cohortId: number
  courseId: number
  emails: string[]
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireStaff()
  const emails = [...new Set(input.emails.map(normEmail).filter(Boolean))]
  if (!emails.length) return { ok: false, error: 'No candidates selected.' }

  const { data, error } = await adminClient()
    .from('challenge_decisions')
    .delete()
    .eq('cohort_id', input.cohortId)
    .eq('course_id', input.courseId)
    .in('email', emails)
    .select('email')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/challenge')
  return { ok: true, count: data?.length ?? 0 }
}

/** Update the editable thresholds the rule engine uses for this challenge. */
export async function updateChallengeReviewConfig(input: {
  cohortId: number
  courseId: number
  thresholds: ReviewThresholds
}): Promise<DecisionResult> {
  const user = await requireStaff()
  const t = input.thresholds
  const bounds = [t.minQuestionsAttemptedPct, t.minActiveDays, t.minSpanDays, t.maxCrammingPct, t.maxGapDays, t.maxWorkIncomeAnnual]
  if (bounds.some((n) => !Number.isInteger(n) || n < 0))
    return { ok: false, error: 'Thresholds must be whole numbers (0 or greater).' }
  if (t.maxCrammingPct > 100) return { ok: false, error: 'Cramming % cannot exceed 100.' }
  if (t.minQuestionsAttemptedPct > 100) return { ok: false, error: 'Questions-attempted % cannot exceed 100.' }
  // Per-capita threshold is optional (null = not set → criterion stays 'na').
  const perCapita = t.maxPerCapitaIncomeAnnual
  if (perCapita !== undefined && (!Number.isInteger(perCapita) || perCapita < 0))
    return { ok: false, error: 'Per-capita income threshold must be a whole number (0 or greater).' }

  // SES: cutoff optional; weights are per-question non-negative numbers.
  const sesCutoff = t.sesCutoff
  if (sesCutoff !== undefined && (!Number.isInteger(sesCutoff) || sesCutoff < 0))
    return { ok: false, error: 'SES cutoff must be a whole number (0 or greater).' }
  const sesWeights = t.sesWeights ?? {}
  if (Object.values(sesWeights).some((w) => typeof w !== 'number' || !Number.isFinite(w) || w < 0))
    return { ok: false, error: 'SES weights must be numbers (0 or greater).' }

  // Excluded colleges: trim, drop blanks, dedupe (case-insensitive).
  const seenCollege = new Set<string>()
  const excludedColleges = (t.excludedColleges ?? [])
    .map((c) => c.trim())
    .filter((c) => {
      const k = c.toLowerCase()
      if (!c || seenCollege.has(k)) return false
      seenCollege.add(k)
      return true
    })

  const { error } = await adminClient()
    .from('challenge_review_config')
    .upsert(
      {
        cohort_id: input.cohortId,
        course_id: input.courseId,
        min_questions_attempted_pct: t.minQuestionsAttemptedPct,
        min_active_days: t.minActiveDays,
        min_span_days: t.minSpanDays,
        max_cramming_pct: t.maxCrammingPct,
        max_gap_days: t.maxGapDays,
        disabled_rules: t.disabledRules ?? [],
        challenge_end_date: t.challengeEndDate || null,
        max_work_income_annual: t.maxWorkIncomeAnnual,
        max_per_capita_income_annual: perCapita ?? null,
        excluded_colleges: excludedColleges,
        ses_weights: sesWeights,
        ses_cutoff: sesCutoff ?? null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cohort_id,course_id' },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/challenge')
  return { ok: true }
}
