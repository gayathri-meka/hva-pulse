import { createClient } from '@supabase/supabase-js'
import { canonicalReferral, canonicalEducation } from '@/lib/marketingFields'
import { fetchChallengeStatusByEmail } from '@/lib/challengeStatus'
import type { ChallengeStatus } from '@/lib/challengeFunnel'
import {
  prospectChallengeStatus,
  motivationInterviewStatus,
  codingInterviewStatus,
  finalVerdictStatus,
  type ProspectChallengeStatus,
  type InterviewPipelineStatus,
  type FinalVerdictStatus,
  type InterviewDecisionLite,
} from '@/lib/prospectPipeline'
import { getAppUser } from '@/lib/auth'
import { groupCommentsByEmail, type ProspectComment } from '@/lib/prospectComments'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
import { sendEmailCampaign } from '../actions'
import ProspectsTable from './ProspectsTable'

export const dynamic = 'force-dynamic'

export type Prospect = {
  id:                          string
  email:                       string
  name:                        string | null
  avatar_url:                  string | null
  phone:                       string | null
  college:                     string | null
  education_status:            string | null
  referral_source:             string | null
  referral_detail:             string | null
  interest_form_submitted_at:  string | null
  challenge_status:            ProspectChallengeStatus
  motivation_interview_status: InterviewPipelineStatus
  coding_interview_status:     InterviewPipelineStatus
  final_verdict:               FinalVerdictStatus
  created_at:                  string
  last_seen_at:                string
}

export default async function ProspectsPage() {
  // prospects RLS restricts reads to admin/staff via auth_role(). The admissions
  // layout already gates this route to those roles; using the service-role
  // client matches the sibling Learner Applications page and avoids any RLS
  // surprises.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data }, challengeStatus, { data: commentRows }, { data: challengeDecisions }, { data: interviewDecisions }, { data: interviews }, { data: codingReviews }, appUser] = await Promise.all([
    supabase
      .from('prospects')
      .select(
        'id, email, name, avatar_url, phone, college, education_status, referral_source, referral_detail, interest_form_submitted_at, created_at, last_seen_at',
      )
      .order('created_at', { ascending: false }),
    fetchChallengeStatusByEmail(supabase),
    supabase
      .from('prospect_comments')
      .select('id, email, body, author_id, author_name, created_at'),
    supabase.from('challenge_decisions').select('email, final_decision, published_at'),
    supabase.from('interview_decisions').select('candidate_email, stage1, final'),
    supabase.from('interviews').select('candidate_email, round, status').eq('status', 'completed'),
    supabase.from('coding_interview_reviews').select('candidate_email, interview_status, verdict'),
    getAppUser(),
  ])

  const commentsByEmail = groupCommentsByEmail((commentRows ?? []) as ProspectComment[])

  // Canonicalize referral/education so prospects render identically to the
  // Website Hits table (no-op for already-canonical values; free-text survives).
  const norm = (email: string | null | undefined) => (email ?? '').trim().toLowerCase()
  const challengeDecisionByEmail = new Map((challengeDecisions ?? []).map((r) => [norm(r.email), {
    finalDecision: r.final_decision as 'selected' | 'rejected',
    released: !!r.published_at,
  }]))
  const interviewDecisionByEmail = new Map((interviewDecisions ?? []).map((r) => [norm(r.candidate_email), {
    stage1: (r.stage1 as 'advance' | 'rejected' | null) ?? null,
    final: (r.final as 'selected' | 'rejected' | null) ?? null,
  } satisfies NonNullable<InterviewDecisionLite>]))
  const completedRounds = new Map<string, Set<number>>()
  for (const interview of interviews ?? []) {
    const email = norm(interview.candidate_email)
    const rounds = completedRounds.get(email) ?? new Set<number>()
    rounds.add(Number(interview.round))
    completedRounds.set(email, rounds)
  }
  const codingReviewByEmail = new Map((codingReviews ?? []).map((r) => [norm(r.candidate_email), r]))

  const prospects = (data ?? []).map((p) => {
    const email = norm(p.email)
    const decision = interviewDecisionByEmail.get(email) ?? null
    const codingReview = codingReviewByEmail.get(email)
    const codingVerdict = (codingReview?.verdict as 'selected' | 'rejected' | null) ?? null
    const codingStatus = codingVerdict === 'selected'
      ? 'Selected'
      : codingVerdict === 'rejected'
        ? 'Rejected'
        : codingReview?.interview_status === 'completed'
          ? 'Decision Pending'
          : codingInterviewStatus(completedRounds.get(email)?.has(2) ?? false, decision)
    const finalVerdict = codingVerdict === 'selected'
      ? 'Selected'
      : codingVerdict === 'rejected' || decision?.stage1 === 'rejected'
        ? 'Rejected'
        : finalVerdictStatus(decision)
    const systemChallenge = challengeStatus.get(email) ?? 'Not joined'
    return {
      ...p,
      referral_source: canonicalReferral(p.referral_source),
      education_status: canonicalEducation(p.education_status),
      challenge_status: prospectChallengeStatus(systemChallenge as ChallengeStatus, challengeDecisionByEmail.get(email) ?? null),
      motivation_interview_status: motivationInterviewStatus(completedRounds.get(email)?.has(1) ?? false, decision),
      coding_interview_status: codingStatus,
      final_verdict: finalVerdict,
    }
  }) as Prospect[]

  const submittedCount = prospects.filter((p) => p.interest_form_submitted_at).length

  return (
    <div>
      <AdmissionsSummary
        description="Everyone who signed up on Pulse."
        stats={[
          { value: prospects.length, label: `prospect${prospects.length !== 1 ? 's' : ''}` },
          { value: submittedCount, label: `interest form${submittedCount !== 1 ? 's' : ''} submitted` },
        ]}
      />
      <ProspectsTable
        prospects={prospects}
        commentsByEmail={commentsByEmail}
        currentUserId={appUser?.id ?? ''}
        isAdmin={appUser?.role === 'admin'}
        currentUserEmail={appUser?.email ?? ''}
        emailAction={sendEmailCampaign}
      />
    </div>
  )
}
