import type { ChallengeStatus as SystemChallengeStatus } from './challengeFunnel'

export type ProspectChallengeStatus = 'Joined' | 'Not Joined' | 'In Progress' | 'Decision Pending' | 'Selected' | 'Rejected'
export type InterviewPipelineStatus = 'Not Done' | 'Decision Pending' | 'Selected' | 'Rejected'
export type FinalVerdictStatus = 'Decision Pending' | 'Selected' | 'Rejected'
export type MotivationInterviewStatus = InterviewPipelineStatus | null
export type CodingInterviewStatus = InterviewPipelineStatus | null
export type PersonalInterviewDecision = 'advance' | 'rejected' | null
export type CodingInterviewVerdict = 'selected' | 'rejected' | null

export type ChallengeDecisionLite = { finalDecision: 'selected' | 'rejected'; released: boolean } | null

export function prospectChallengeStatus(
  system: SystemChallengeStatus,
  decision: ChallengeDecisionLite,
  reviewSystemInProgress = system === 'Started',
): ProspectChallengeStatus {
  if (decision?.released) return decision.finalDecision === 'selected' ? 'Selected' : 'Rejected'
  if (system === 'Not joined') return 'Not Joined'
  if (reviewSystemInProgress) return 'In Progress'
  if (system === 'Completed' || decision) return 'Decision Pending'
  return 'Joined'
}

export function motivationInterviewStatus(
  challengeStatus: ProspectChallengeStatus,
  interviewStatus: string | null,
  decision: PersonalInterviewDecision,
): MotivationInterviewStatus {
  if (challengeStatus === 'Rejected') return null
  if (challengeStatus === 'In Progress') return 'Not Done'
  if (decision === 'advance') return 'Selected'
  if (decision === 'rejected') return 'Rejected'
  if (interviewStatus === 'completed') return 'Decision Pending'
  return 'Not Done'
}

export function codingInterviewStatus(
  interviewStatus: string | null,
  verdict: CodingInterviewVerdict,
  motivationStatus: MotivationInterviewStatus,
  challengeStatus: ProspectChallengeStatus,
): CodingInterviewStatus {
  if (challengeStatus === 'Rejected' || motivationStatus === 'Rejected') return null
  if (verdict === 'rejected') return 'Rejected'
  if (verdict === 'selected') return 'Selected'
  return interviewStatus === 'completed' ? 'Decision Pending' : 'Not Done'
}

export function finalVerdictStatus(
  challengeStatus: ProspectChallengeStatus,
  motivationStatus: MotivationInterviewStatus,
  codingStatus: CodingInterviewStatus,
): FinalVerdictStatus {
  if (challengeStatus === 'Rejected' || motivationStatus === 'Rejected' || codingStatus === 'Rejected') return 'Rejected'
  if (codingStatus === 'Selected') return 'Selected'
  return 'Decision Pending'
}
