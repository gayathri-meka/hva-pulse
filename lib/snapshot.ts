type ApplicationRow = { status: string }
type PreferenceRow  = { preference: string; reasons?: string[] | null }

export type SnapshotStats = {
  total: number
  applied: number
  notInterested: number
  ignored: number
  shortlisted: number
  onHold: number
  notShortlisted: number
  rejected: number
  hired: number
  pending: number
  applicationRate: number
  reasonCounts: Record<string, number>
}

export function computeSnapshot(
  totalRoles: number,
  applications: ApplicationRow[],
  preferences: PreferenceRow[],
): SnapshotStats {
  const niList             = preferences.filter((p) => p.preference === 'not_interested')
  const appliedCount       = applications.length
  const notInterestedCount = niList.length
  const ignoredCount       = totalRoles - appliedCount - notInterestedCount

  const shortlistedCount    = applications.filter((a) => a.status === 'shortlisted').length
  const onHoldCount         = applications.filter((a) => a.status === 'on_hold').length
  const notShortlistedCount = applications.filter((a) => a.status === 'not_shortlisted').length
  const rejectedCount       = applications.filter((a) => a.status === 'rejected').length
  const hiredCount          = applications.filter((a) => a.status === 'hired').length
  const pendingCount        = applications.filter((a) => a.status === 'applied').length

  const applicationRate =
    totalRoles > 0 ? Math.round((appliedCount / totalRoles) * 100) : 0

  const allReasons = niList.flatMap((p) => p.reasons ?? [])
  const reasonCounts: Record<string, number> = {}
  allReasons.forEach((r) => {
    reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
  })

  return {
    total:          totalRoles,
    applied:        appliedCount,
    notInterested:  notInterestedCount,
    ignored:        ignoredCount,
    shortlisted:    shortlistedCount,
    onHold:         onHoldCount,
    notShortlisted: notShortlistedCount,
    rejected:       rejectedCount,
    hired:          hiredCount,
    pending:        pendingCount,
    applicationRate,
    reasonCounts,
  }
}
