import { createClient } from '@supabase/supabase-js'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
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
  interest_form_submitted_at:  string | null
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

  const { data } = await supabase
    .from('prospects')
    .select(
      'id, email, name, avatar_url, phone, college, education_status, interest_form_submitted_at, created_at, last_seen_at',
    )
    .order('created_at', { ascending: false })

  const prospects = (data ?? []) as Prospect[]

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
      <ProspectsTable prospects={prospects} />
    </div>
  )
}
