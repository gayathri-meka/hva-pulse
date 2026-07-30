import type { ChallengeStatus as SystemChallengeStatus } from './challengeFunnel'

export type ProspectChallengeStatus = 'Joined' | 'Not Joined' | 'In Progress' | 'Decision Pending' | 'Selected' | 'Rejected'
export type InterviewPipelineStatus = 'Not Done' | 'Decision Pending' | 'Selected' | 'Rejected'
export type FinalVerdictStatus = 'Decision Pending' | 'Selected' | 'Rejected'

export type ChallengeDecisionLite = { finalDecision: 'selected' | 'rejected'; released: boolean } | null
export type InterviewDecisionLite = { stage1: 'advance' | 'rejected' | null; final: 'selected' | 'rejected' | null } | null

export function prospectChallengeStatus(system: SystemChallengeStatus, decision: ChallengeDecisionLite): ProspectChallengeStatus {
  if (decision?.released) return decision.finalDecision === 'selected' ? 'Selected' : 'Rejected'
  if (system === 'Started') return 'In Progress'
  if (system === 'Completed') return 'Decision Pending'
  return system === 'Joined' ? 'Joined' : 'Not Joined'
}

export function motivationInterviewStatus(completed: boolean, decision: InterviewDecisionLite): InterviewPipelineStatus {
  if (decision?.stage1 === 'advance') return 'Selected'
  if (decision?.stage1 === 'rejected') return 'Rejected'
  return completed ? 'Decision Pending' : 'Not Done'
}

export function codingInterviewStatus(completed: boolean, decision: InterviewDecisionLite): InterviewPipelineStatus {
  if (decision?.final === 'selected') return 'Selected'
  if (decision?.final === 'rejected') return 'Rejected'
  return completed ? 'Decision Pending' : 'Not Done'
}

export function finalVerdictStatus(decision: InterviewDecisionLite): FinalVerdictStatus {
  if (decision?.final === 'selected') return 'Selected'
  if (decision?.stage1 === 'rejected' || decision?.final === 'rejected') return 'Rejected'
  return 'Decision Pending'
}
