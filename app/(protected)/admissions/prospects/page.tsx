import { createClient } from '@supabase/supabase-js'
import { canonicalReferral, canonicalEducation } from '@/lib/marketingFields'
import {
  fetchChallengeRawRows,
  challengeReviewConfigKey,
  challengeReviewInProgressByEmail,
} from '@/lib/challengeStatus'
import { challengeStatusByEmail, type ChallengeStatus } from '@/lib/challengeFunnel'
import {
  prospectChallengeStatus,
  motivationInterviewStatus,
  codingInterviewStatus,
  finalVerdictStatus,
  type ProspectChallengeStatus,
  type InterviewPipelineStatus,
  type FinalVerdictStatus,
  type MotivationInterviewStatus,
  type CodingInterviewStatus,
  type PersonalInterviewVerdict,
  type CodingInterviewVerdict,
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
  motivation_interview_status: MotivationInterviewStatus
  coding_interview_status:     CodingInterviewStatus
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

  const [{ data }, challengeRows, { data: commentRows }, { data: challengeDecisions }, { data: challengeConfigs }, { data: interviews }, { data: codingReviews }, appUser] = await Promise.all([
    supabase
      .from('prospects')
      .select(
        'id, email, name, avatar_url, phone, college, education_status, referral_source, referral_detail, interest_form_submitted_at, created_at, last_seen_at',
      )
      .order('created_at', { ascending: false }),
    fetchChallengeRawRows(supabase),
    supabase
      .from('prospect_comments')
      .select('id, email, body, author_id, author_name, created_at'),
    supabase.from('challenge_decisions').select('email, final_decision, published_at'),
    supabase.from('challenge_review_config').select('cohort_id, course_id, challenge_end_date'),
    supabase.from('interviews').select('candidate_email, round, status, recommendation'),
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
  const challengeStatus = challengeStatusByEmail(challengeRows)
  const challengeEndDateByConfig = new Map(
    (challengeConfigs ?? []).map((config) => [
      challengeReviewConfigKey(String(config.cohort_id), String(config.course_id)),
      (config.challenge_end_date as string | null) ?? null,
    ]),
  )
  const challengeInProgress = challengeReviewInProgressByEmail(challengeRows, challengeEndDateByConfig)
  const personalInterviewByEmail = new Map<string, { status: string; verdict: PersonalInterviewVerdict; rank: number }>()
  for (const interview of interviews ?? []) {
    if (Number(interview.round) !== 1 || interview.status === 'cancelled') continue
    const email = norm(interview.candidate_email)
    const verdict = (interview.recommendation as PersonalInterviewVerdict) ?? null
    const rank = verdict === 'advance' || verdict === 'no' ? 3 : interview.status === 'completed' ? 2 : 1
    if (rank > (personalInterviewByEmail.get(email)?.rank ?? 0))
      personalInterviewByEmail.set(email, { status: interview.status, verdict, rank })
  }
  const codingReviewByEmail = new Map((codingReviews ?? []).map((r) => [norm(r.candidate_email), r]))

  const prospects = (data ?? []).map((p) => {
    const email = norm(p.email)
    const systemChallenge = challengeStatus.get(email) ?? 'Not joined'
    const challengePipelineStatus = prospectChallengeStatus(
      systemChallenge as ChallengeStatus,
      challengeDecisionByEmail.get(email) ?? null,
      challengeInProgress.get(email) ?? false,
    )
    const personalInterview = personalInterviewByEmail.get(email)
    const motivationStatus = motivationInterviewStatus(
      challengePipelineStatus,
      personalInterview?.status ?? null,
      personalInterview?.verdict ?? null,
    )
    const codingReview = codingReviewByEmail.get(email)
    const codingStatus = codingInterviewStatus(
      (codingReview?.interview_status as string | null) ?? null,
      (codingReview?.verdict as CodingInterviewVerdict) ?? null,
      motivationStatus,
      challengePipelineStatus,
    )
    return {
      ...p,
      referral_source: canonicalReferral(p.referral_source),
      education_status: canonicalEducation(p.education_status),
      challenge_status: challengePipelineStatus,
      motivation_interview_status: motivationStatus,
      coding_interview_status: codingStatus,
      final_verdict: finalVerdictStatus(challengePipelineStatus, motivationStatus, codingStatus),
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
