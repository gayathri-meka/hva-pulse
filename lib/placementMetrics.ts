// Number of distinct learners placed = unique user_ids among hired applications.
// We dedupe by user_id (not raw hired-application count) because "learners
// placed" is a headcount, and a learner could in principle have more than one
// hired application row.

export function uniqueHiredLearnerCount(
  apps: { status: string; user_id?: string | null }[],
): number {
  const learners = new Set<string>()
  for (const a of apps) {
    if (a.status === 'hired' && a.user_id) learners.add(a.user_id)
  }
  return learners.size
}
