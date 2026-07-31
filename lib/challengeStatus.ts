import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CHALLENGE_VIEW,
  challengeStatusByEmail,
  type ChallengeRawRow,
  type ChallengeStatus,
} from './challengeFunnel'
import { isChallengeFinished } from './challengeReview'

export type { ChallengeStatus }

// Fetches every "Challenge Completion" synced row (one per member×task) from
// metric_raw_rows. PostgREST caps a single response at 1000 rows, so a bare
// .limit() silently truncates and any downstream funnel undercounts — page
// through with .range() instead. Returns [] if the source isn't connected.
//
// This is the single source of truth for loading challenge rows; the dashboard,
// Admissions → Analytics, and the per-email status map all use it.
export async function fetchChallengeRawRows(supabase: SupabaseClient): Promise<ChallengeRawRow[]> {
  const { data: src } = await supabase
    .from('metric_sources')
    .select('id')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()
  if (!src) return []

  const PAGE = 1000
  const rows: ChallengeRawRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('metric_raw_rows')
      .select('learner_id, dimensions')
      .eq('source_id', src.id)
      // Stable sort REQUIRED — unordered offset pagination skips/duplicates rows.
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    rows.push(...(data as ChallengeRawRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

// Map of normalised email -> challenge status. Emails absent from the map are
// 'Not joined'. Used to add a "Challenge" column to the Prospects and Website
// Hits tables — joined to those rows by email (see challengeStatusByEmail).
export async function fetchChallengeStatusByEmail(
  supabase: SupabaseClient,
): Promise<Map<string, ChallengeStatus>> {
  return challengeStatusByEmail(await fetchChallengeRawRows(supabase))
}

export type ChallengeReviewConfigKey = `${number}|${number}`

export function challengeReviewConfigKey(
  cohortId: string | null | undefined,
  courseId: string | null | undefined,
): ChallengeReviewConfigKey {
  return `${Number(cohortId ?? 0)}|${Number(courseId ?? 0)}`
}

// Mirrors the Challenge → Review table's `System = In progress` condition.
export function challengeReviewInProgressByEmail(
  rows: ChallengeRawRow[],
  challengeEndDateByConfig: Map<ChallengeReviewConfigKey, string | null>,
  nowMs = Date.now(),
): Map<string, boolean> {
  const taskTotals = new Map<ChallengeReviewConfigKey, Map<string, number>>()
  const candidates = new Map<string, {
    configKey: ChallengeReviewConfigKey
    attemptedQuestions: number
    lastActiveMs: number | null
    seenTasks: Set<string>
  }>()

  for (const row of rows) {
    const email = (row.learner_id ?? '').trim().toLowerCase()
    if (!email) continue
    const dim = row.dimensions ?? {}
    const configKey = challengeReviewConfigKey(dim.cohort_id, dim.course_id)
    const taskId = dim.task_id ?? ''
    const totals = taskTotals.get(configKey) ?? new Map<string, number>()
    if (taskId && !totals.has(taskId)) totals.set(taskId, Number(dim.total_questions ?? 0))
    taskTotals.set(configKey, totals)

    const candidate = candidates.get(email) ?? {
      configKey,
      attemptedQuestions: 0,
      lastActiveMs: null,
      seenTasks: new Set<string>(),
    }
    if (!taskId || !candidate.seenTasks.has(taskId)) {
      if (taskId) candidate.seenTasks.add(taskId)
      candidate.attemptedQuestions += Number(dim.attempted_questions ?? 0)
      const activity = parseChallengeActivityMs(dim.last_activity_at)
      if (activity != null)
        candidate.lastActiveMs = candidate.lastActiveMs == null ? activity : Math.max(candidate.lastActiveMs, activity)
    }
    candidates.set(email, candidate)
  }

  const result = new Map<string, boolean>()
  for (const [email, candidate] of candidates) {
    const totalQuestions = [...(taskTotals.get(candidate.configKey)?.values() ?? [])]
      .reduce((sum, total) => sum + total, 0)
    result.set(email, !isChallengeFinished({
      lastActive: candidate.lastActiveMs == null ? null : new Date(candidate.lastActiveMs).toISOString(),
      attemptedQuestions: candidate.attemptedQuestions,
      totalQuestions,
      nowMs,
      challengeEndDate: challengeEndDateByConfig.get(candidate.configKey),
    }))
  }
  return result
}

function parseChallengeActivityMs(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}
