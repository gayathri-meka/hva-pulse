// Shared status-label vocabulary for the cases UI.
// The DB still uses the older enum (open | in_progress | follow_up | closed)
// plus an outcome field (resolved | dropped | other). These labels are
// presentation-only and derived from those columns.

export type CaseStatusLabel =
  | 'Open'
  | 'Root Cause Pending'
  | 'Action Items Pending'
  | 'Monitoring'
  | 'Needs review'
  | 'Back on Track'
  | 'Closed'

type CaseShape = {
  status:              string
  decision_date:       string | null
  step2_completed_at:  string | null
  outcome:             string | null
}

export function deriveCaseLabel(
  iv: CaseShape,
  todayIso: string,
): CaseStatusLabel {
  if (iv.status === 'closed') return iv.outcome === 'resolved' ? 'Back on Track' : 'Closed'
  if (iv.status === 'follow_up') {
    if (iv.decision_date && iv.decision_date <= todayIso) return 'Needs review'
    return 'Monitoring'
  }
  if (iv.status === 'in_progress') {
    if (!iv.step2_completed_at) return 'Root Cause Pending'
    return 'Action Items Pending'
  }
  return 'Open'
}

export const CASE_LABEL_RANK: Record<CaseStatusLabel, number> = {
  'Needs review':         0,
  'Open':                 1,
  'Root Cause Pending':   2,
  'Action Items Pending': 3,
  'Monitoring':           4,
  'Back on Track':        5,
  'Closed':               6,
}
