// Shared challenge-funnel maths so the Admissions → Challenge tab and the
// Analytics tab report identical joined / started / completed numbers.
//
// Input: the metric_raw_rows for the "Challenge Completion" source — one row
// per (cohort member, task), with `dimensions.state` ∈ not_started|attempted|completed.

export const CHALLENGE_VIEW = 'pulse_challenge_task_status'

export type ChallengeRawRow = {
  learner_id: string | null
  dimensions: Record<string, string | null> | null
}

export type ChallengeFunnel = { joined: number; started: number; completed: number }

export function challengeFunnel(rows: ChallengeRawRow[]): ChallengeFunnel {
  const byEmail = new Map<string, { total: number; completed: number; anyStarted: boolean }>()
  for (const r of rows) {
    const email = (r.learner_id ?? '').trim().toLowerCase()
    if (!email) continue
    const state = r.dimensions?.state ?? 'not_started'
    const e = byEmail.get(email) ?? { total: 0, completed: 0, anyStarted: false }
    e.total += 1
    if (state === 'completed') e.completed += 1
    if (state !== 'not_started') e.anyStarted = true
    byEmail.set(email, e)
  }

  let joined = 0
  let started = 0
  let completed = 0
  for (const e of byEmail.values()) {
    joined += 1
    if (e.anyStarted) started += 1
    if (e.total > 0 && e.completed === e.total) completed += 1
  }
  return { joined, started, completed }
}

// BigQuery TIMESTAMPs land in metric_raw_rows as epoch-SECONDS strings, often in
// scientific notation (e.g. "1.781678026E9"). Parse to epoch-ms, or null if absent.
function epochMs(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n * 1000
}

// Per-learner event timestamps for the weekly trends in Admissions → Analytics.
// Each array holds one ISO date per learner who reached that funnel stage:
//   joined    — when they joined the SensAI cohort (dimensions.joined_at)
//   started   — their first task activity (earliest dimensions.last_activity_at)
//   completed — when they finished (latest activity, only if all tasks completed)
// `joined` is empty until the BQ view exposing joined_at (migrations/bq/004) is
// re-applied and re-synced; the headline counts stay correct regardless.
export type ChallengeEventDates = { joined: string[]; started: string[]; completed: string[] }

export function challengeEventDates(rows: ChallengeRawRow[]): ChallengeEventDates {
  type Agg = {
    total: number
    completed: number
    anyStarted: boolean
    joinedAt: number | null
    firstActivity: number | null
    lastActivity: number | null
  }
  const byEmail = new Map<string, Agg>()
  const seen = new Set<string>()
  for (const r of rows) {
    const email = (r.learner_id ?? '').trim().toLowerCase()
    if (!email) continue
    const dim = r.dimensions ?? {}
    const taskId = dim.task_id ?? ''
    const key = `${email}|${taskId}`
    if (seen.has(key)) continue
    seen.add(key)
    const state = dim.state ?? 'not_started'
    const e =
      byEmail.get(email) ??
      { total: 0, completed: 0, anyStarted: false, joinedAt: null, firstActivity: null, lastActivity: null }
    e.total += 1
    if (state === 'completed') e.completed += 1
    const joined = epochMs(dim.joined_at)
    if (joined != null) e.joinedAt = e.joinedAt == null ? joined : Math.min(e.joinedAt, joined)
    if (state !== 'not_started') {
      e.anyStarted = true
      const act = epochMs(dim.last_activity_at)
      if (act != null) {
        e.firstActivity = e.firstActivity == null ? act : Math.min(e.firstActivity, act)
        e.lastActivity = e.lastActivity == null ? act : Math.max(e.lastActivity, act)
      }
    }
    byEmail.set(email, e)
  }

  const out: ChallengeEventDates = { joined: [], started: [], completed: [] }
  for (const e of byEmail.values()) {
    if (e.joinedAt != null) out.joined.push(new Date(e.joinedAt).toISOString())
    if (e.anyStarted && e.firstActivity != null) out.started.push(new Date(e.firstActivity).toISOString())
    if (e.total > 0 && e.completed === e.total && e.lastActivity != null)
      out.completed.push(new Date(e.lastActivity).toISOString())
  }
  return out
}

// Per-learner challenge status, for joining onto the Prospects / Website Hits tables.
export type ChallengeStatus = 'Completed' | 'Started' | 'Joined' | 'Not joined'

// Map of normalised email -> status for everyone present in the challenge cohort.
// Emails absent from the map are 'Not joined'. Dedupes (email, task) so duplicate
// synced rows can't skew the completed === total check.
export function challengeStatusByEmail(rows: ChallengeRawRow[]): Map<string, ChallengeStatus> {
  const byEmail = new Map<string, { total: number; completed: number; anyStarted: boolean }>()
  const seen = new Set<string>()
  for (const r of rows) {
    const email = (r.learner_id ?? '').trim().toLowerCase()
    if (!email) continue
    const taskId = r.dimensions?.task_id ?? ''
    const key = `${email}|${taskId}`
    if (seen.has(key)) continue
    seen.add(key)
    const state = r.dimensions?.state ?? 'not_started'
    const e = byEmail.get(email) ?? { total: 0, completed: 0, anyStarted: false }
    e.total += 1
    if (state === 'completed') e.completed += 1
    if (state !== 'not_started') e.anyStarted = true
    byEmail.set(email, e)
  }

  const out = new Map<string, ChallengeStatus>()
  for (const [email, e] of byEmail) {
    out.set(
      email,
      e.total > 0 && e.completed === e.total ? 'Completed' : e.anyStarted ? 'Started' : 'Joined',
    )
  }
  return out
}
