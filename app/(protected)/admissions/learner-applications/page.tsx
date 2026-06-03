import { createClient } from '@supabase/supabase-js'
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
  signed_into_pulse:  boolean
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
      .select('id, created_at, name, phone, email, college_name, educational_status')
      .order('created_at', { ascending: false }),
    supabase.from('prospects').select('email'),
  ])

  const prospectEmails = new Set(
    (prospectRows ?? []).map((p) => (p.email ?? '').toLowerCase()),
  )

  const applications: LearnerApplication[] = (rawApps ?? []).map((a) => ({
    ...a,
    signed_into_pulse: a.email ? prospectEmails.has(a.email.toLowerCase()) : false,
  }))

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500">
        {applications.length} application{applications.length !== 1 ? 's' : ''} submitted via the website form
      </p>
      <LearnerApplicationsTable applications={applications} />
    </div>
  )
}
