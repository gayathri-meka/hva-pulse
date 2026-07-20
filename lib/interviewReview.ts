// Pure state machine for the interview Review tab. Given a candidate's interviews
// and the team's released decisions, derive their pipeline stage + which release
// actions are available. No I/O — unit-tested.

export type InterviewRoundState = 'not_booked' | 'scheduled' | 'completed' | 'no_show'
export type Recommendation = 'advance' | 'borderline' | 'no'
export type Stage1Decision = 'advance' | 'rejected' // team's post-Round-1 release
export type FinalDecision = 'selected' | 'rejected' // team's post-Round-2 release

export type ReviewStage =
  | 'round1' // in Round 1 (not booked / scheduled), not yet done
  | 'awaiting_r1_review' // Round 1 done, team hasn't released a decision
  | 'round2_open' // advanced; Round 2 not booked yet
  | 'round2' // in Round 2 (scheduled), not yet done
  | 'awaiting_final' // Round 2 done, team hasn't made the final call
  | 'selected'
  | 'rejected'

export type RoundInfo = { status: InterviewRoundState; recommendation: Recommendation | null }

export type InterviewDecision = { stage1: Stage1Decision | null; final: FinalDecision | null }

export type InterviewReviewRow = {
  round1: RoundInfo
  round2: RoundInfo
  stage: ReviewStage
  stage1: Stage1Decision | null
  final: FinalDecision | null
  canReleaseStage1: boolean // Round 1 done + no stage-1 decision yet
  canReleaseFinal: boolean // advanced + Round 2 done + no final decision yet
}

export type InterviewLite = {
  round: 1 | 2
  status: 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
  recommendation?: Recommendation | null
}

const STAGE_LABELS: Record<ReviewStage, string> = {
  round1: 'Round 1',
  awaiting_r1_review: 'Awaiting R1 review',
  round2_open: 'Round 2 open',
  round2: 'Round 2',
  awaiting_final: 'Awaiting final',
  selected: 'Selected',
  rejected: 'Rejected',
}
export const stageLabel = (s: ReviewStage) => STAGE_LABELS[s]

export function roundState(iv: InterviewLite | undefined): RoundInfo {
  if (!iv) return { status: 'not_booked', recommendation: null }
  const status: InterviewRoundState =
    iv.status === 'completed' ? 'completed' : iv.status === 'no_show' ? 'no_show' : 'scheduled'
  return { status, recommendation: iv.recommendation ?? null }
}

// A round is "done" (awaiting a team call) once it's been conducted OR the
// candidate no-showed — both need a human decision to move or end the pipeline.
const isDone = (s: InterviewRoundState) => s === 'completed' || s === 'no_show'

export function computeInterviewReviewRow(
  interviews: InterviewLite[],
  decision: InterviewDecision | null,
): InterviewReviewRow {
  const active = interviews.filter((i) => i.status !== 'cancelled')
  const round1 = roundState(active.find((i) => i.round === 1))
  const round2 = roundState(active.find((i) => i.round === 2))
  const stage1 = decision?.stage1 ?? null
  const final = decision?.final ?? null

  const r1Done = isDone(round1.status)
  const r2Done = isDone(round2.status)

  let stage: ReviewStage
  if (final === 'selected') stage = 'selected'
  else if (final === 'rejected' || stage1 === 'rejected') stage = 'rejected'
  else if (stage1 === 'advance') {
    if (r2Done) stage = 'awaiting_final'
    else if (round2.status === 'not_booked') stage = 'round2_open'
    else stage = 'round2'
  } else {
    stage = r1Done ? 'awaiting_r1_review' : 'round1'
  }

  return {
    round1,
    round2,
    stage,
    stage1,
    final,
    canReleaseStage1: r1Done && stage1 == null,
    canReleaseFinal: stage1 === 'advance' && r2Done && final == null,
  }
}
