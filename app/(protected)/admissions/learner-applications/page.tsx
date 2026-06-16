import { createClient } from '@supabase/supabase-js'
import { buildProspectIndex, matchSignup, type MatchMethod } from '@/lib/signupMatch'
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
}

export default async function LearnerApplicationsPage() {
  // learner_applications has RLS enabled with no SELECT policy for authenticated
  // users (only an anon INSERT policy for the public website form), so we read
  // via the service-role client. Same pattern as JD/resume storage uploads.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: rawApps }, { data: prospectRows }] = await Promise.all([
    supabase
      .from('learner_applications')
      .select('id, created_at, name, phone, email, college_name, educational_status, referral_source, referral_detail, signup_token, signed_up_at')
      .order('created_at', { ascending: false }),
    supabase.from('prospects').select('email, signup_token'),
  ])

  // Token-first, email-fallback matching (see lib/signupMatch.ts).
  const index = buildProspectIndex(prospectRows ?? [])

  const applications: LearnerApplication[] = (rawApps ?? []).map((a) => {
    const match = matchSignup(a, index)
    return { ...a, signed_into_pulse: match.matched, match_method: match.method }
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
      <LearnerApplicationsTable applications={applications} />
    </div>
  )
}
