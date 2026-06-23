import { createClient } from '@supabase/supabase-js'
import { buildProspectIndex, matchSignup, type MatchMethod } from '@/lib/signupMatch'
import { canonicalReferral, canonicalEducation } from '@/lib/marketingFields'
import { fetchChallengeStatusByEmail } from '@/lib/challengeStatus'
import type { ChallengeStatus } from '@/lib/challengeFunnel'
import { getAppUser } from '@/lib/auth'
import { groupCommentsByEmail, type ProspectComment } from '@/lib/prospectComments'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
import LearnerApplicationsTable from './LearnerApplicationsTable'

export const dynamic = 'force-dynamic'

export type LearnerApplication = {
  id:                 string
  created_at:         string
  name:               string | null
  phone:              string | null
  email:              string | null
  college_name:       string | null
  educational_status: string | null
  referral_source:    string | null
  referral_detail:    string | null
  signup_token:       string | null
  signed_up_at:       string | null
  signed_into_pulse:  boolean
  match_method:       MatchMethod
  challenge_status:   ChallengeStatus
}

export default async function LearnerApplicationsPage() {
  // learner_applications has RLS enabled with no SELECT policy for authenticated
  // users (only an anon INSERT policy for the public website form), so we read
  // via the service-role client. Same pattern as JD/resume storage uploads.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: rawApps }, { data: prospectRows }, challengeStatus, { data: commentRows }, appUser] = await Promise.all([
    supabase
      .from('learner_applications')
      .select('id, created_at, name, phone, email, college_name, educational_status, referral_source, referral_detail, signup_token, signed_up_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('prospects')
      .select('email, signup_token, name, phone, college, education_status, referral_source, referral_detail'),
    fetchChallengeStatusByEmail(supabase),
    supabase
      .from('prospect_comments')
      .select('id, email, body, author_id, author_name, created_at'),
    getAppUser(),
  ])

  const commentsByEmail = groupCommentsByEmail((commentRows ?? []) as ProspectComment[])

  // Token-first, email-fallback matching (see lib/signupMatch.ts).
  const index = buildProspectIndex(prospectRows ?? [])

  // The website form is the only writer of learner_applications, so any field a
  // learner filled out on the Pulse interest form instead lives only on their
  // prospect row. Index prospects by normalised email so we can backfill those
  // gaps. matchSignup() hands us the matched prospect's email (token-first), so
  // the join here uses the exact same "signed up" definition as the table.
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  const prospectByEmail = new Map<string, any>()
  for (const p of prospectRows ?? []) {
    const key = norm(p.email)
    if (key) prospectByEmail.set(key, p)
  }
  // First non-empty value wins — treats both null and '' as missing.
  const firstFilled = (...vals: (string | null | undefined)[]) =>
    vals.find((v) => v != null && v !== '') ?? null

  const applications: LearnerApplication[] = (rawApps ?? []).map((a) => {
    const match = matchSignup(a, index)
    const p = match.prospectEmail ? prospectByEmail.get(match.prospectEmail) : undefined
    return {
      ...a,
      name:               firstFilled(a.name, p?.name),
      phone:              firstFilled(a.phone, p?.phone),
      college_name:       firstFilled(a.college_name, p?.college),
      // Canonicalize to the human-readable label so the website-form's raw codes
      // (friend, college_2027) and the prospect's labels render identically.
      educational_status: canonicalEducation(firstFilled(a.educational_status, p?.education_status)),
      referral_source:    canonicalReferral(firstFilled(a.referral_source, p?.referral_source)),
      referral_detail:    firstFilled(a.referral_detail, p?.referral_detail),
      signed_into_pulse:  match.matched,
      match_method:       match.method,
      // Join challenge status by email — prefer the matched prospect's email
      // (token-first), falling back to the application's own email.
      challenge_status:
        challengeStatus.get((match.prospectEmail ?? a.email)?.trim().toLowerCase() ?? '') ?? 'Not joined',
    }
  })

  // Unique count using the same rule as the table's "hide duplicates": one per
  // email (case-insensitive), emailless rows always counted individually.
  const seen = new Set<string>()
  const uniqueCount = applications.filter((a) => {
    const key = a.email?.trim().toLowerCase()
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).length

  return (
    <div>
      <AdmissionsSummary
        description="All the applications we received through the website."
        stats={[
          { value: applications.length, label: `application${applications.length !== 1 ? 's' : ''}` },
          { value: uniqueCount, label: `unique${applications.length !== uniqueCount ? ` (${applications.length - uniqueCount} duplicate${applications.length - uniqueCount !== 1 ? 's' : ''})` : ''}` },
        ]}
      />
      <LearnerApplicationsTable
        applications={applications}
        commentsByEmail={commentsByEmail}
        currentUserId={appUser?.id ?? ''}
        isAdmin={appUser?.role === 'admin'}
      />
    </div>
  )
}
