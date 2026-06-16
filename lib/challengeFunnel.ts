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
