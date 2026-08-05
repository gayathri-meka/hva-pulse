import { normEmail, type InterviewStatus, type SlotStatus } from './interviews'

export type MotivationAnalyticsSlot = {
  id: string
  round: number | null
  startsAt: string
  status: SlotStatus
}

export type MotivationAnalyticsInterview = {
  candidateEmail: string
  round: number
  slotId: string | null
  scheduledAt: string
  status: InterviewStatus
  recommendation: 'advance' | 'borderline' | 'no' | null
  assessedAt?: string | null
}

export type MotivationInterviewAnalytics = {
  totalAvailableSlots: number
  scheduledInterviews: number
  advanced: number
  borderline: number
  doNotAdvance: number
}

export type CodingInterviewDecision = {
  candidateEmail: string
  final: 'selected' | 'rejected' | null
}

export type CodingInterviewAnalytics = {
  shortlisted: number
  selected: number
  rejected: number
}

/** Lifetime unique-candidate counts for the Coding Interview pipeline. */
export function computeCodingInterviewAnalytics(
  decisions: CodingInterviewDecision[],
  shortlistedFromPersonalInterview: number,
): CodingInterviewAnalytics {
  const selected = new Set<string>()
  const rejected = new Set<string>()

  for (const decision of decisions) {
    const email = normEmail(decision.candidateEmail)
    if (!email) continue
    if (decision.final === 'selected') selected.add(email)
    else if (decision.final === 'rejected') rejected.add(email)
  }

  return {
    shortlisted: shortlistedFromPersonalInterview,
    selected: selected.size,
    rejected: rejected.size,
  }
}

/**
 * Metrics for Round 1 (Motivation). Availability and scheduled counts are a
 * point-in-time view; recommendations are lifetime counts. A candidate's most
 * recently assessed recommendation wins so they can appear in only one bucket.
 */
export function computeMotivationInterviewAnalytics(
  slots: MotivationAnalyticsSlot[],
  interviews: MotivationAnalyticsInterview[],
  now: Date,
): MotivationInterviewAnalytics {
  const nowMs = now.getTime()
  const validUpcomingSlots = new Map(
    slots
      .filter((slot) =>
        slot.round === 1 &&
        slot.status !== 'blocked' &&
        new Date(slot.startsAt).getTime() >= nowMs,
      )
      .map((slot) => [slot.id, slot]),
  )

  const scheduledCandidates = new Set<string>()
  for (const interview of interviews) {
    const email = normEmail(interview.candidateEmail)
    if (
      email &&
      interview.round === 1 &&
      interview.status === 'confirmed' &&
      interview.slotId != null &&
      validUpcomingSlots.has(interview.slotId) &&
      new Date(interview.scheduledAt).getTime() >= nowMs
    ) {
      scheduledCandidates.add(email)
    }
  }

  const latestRecommendation = new Map<string, MotivationAnalyticsInterview>()
  for (const interview of interviews) {
    const email = normEmail(interview.candidateEmail)
    if (!email || interview.round !== 1 || interview.recommendation == null) continue

    const current = latestRecommendation.get(email)
    const assessedAt = interview.assessedAt ? new Date(interview.assessedAt).getTime() : 0
    const currentAssessedAt = current?.assessedAt ? new Date(current.assessedAt).getTime() : 0
    if (!current || assessedAt >= currentAssessedAt) latestRecommendation.set(email, interview)
  }

  let advanced = 0
  let borderline = 0
  let doNotAdvance = 0
  for (const interview of latestRecommendation.values()) {
    if (interview.recommendation === 'advance') advanced++
    else if (interview.recommendation === 'borderline') borderline++
    else if (interview.recommendation === 'no') doNotAdvance++
  }

  return {
    totalAvailableSlots: validUpcomingSlots.size,
    scheduledInterviews: scheduledCandidates.size,
    advanced,
    borderline,
    doNotAdvance,
  }
}
