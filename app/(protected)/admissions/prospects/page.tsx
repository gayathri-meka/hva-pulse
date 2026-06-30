import { createClient } from '@supabase/supabase-js'
import { canonicalReferral, canonicalEducation } from '@/lib/marketingFields'
import { fetchChallengeStatusByEmail } from '@/lib/challengeStatus'
import type { ChallengeStatus } from '@/lib/challengeFunnel'
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
  challenge_status:            ChallengeStatus
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

  const [{ data }, challengeStatus, { data: commentRows }, appUser] = await Promise.all([
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
    getAppUser(),
  ])

  const commentsByEmail = groupCommentsByEmail((commentRows ?? []) as ProspectComment[])

  // Canonicalize referral/education so prospects render identically to the
  // Website Hits table (no-op for already-canonical values; free-text survives).
  const prospects = (data ?? []).map((p) => ({
    ...p,
    referral_source:  canonicalReferral(p.referral_source),
    education_status: canonicalEducation(p.education_status),
    challenge_status: challengeStatus.get(p.email?.trim().toLowerCase()) ?? 'Not joined',
  })) as Prospect[]

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
