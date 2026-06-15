import { createClient } from '@supabase/supabase-js'
import AnalyticsClient from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export type AnalyticsRow = {
  created_at:    string
  email:         string | null
  signup_token?: string | null
  signed_up_at?: string | null
}

export default async function AdmissionsAnalyticsPage() {
  // learner_applications + prospects both have RLS that blocks authenticated
  // SELECTs, so read via the service-role client (same pattern as the other
  // admissions pages).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: hits }, { data: signups }] = await Promise.all([
    supabase
      .from('learner_applications')
      .select('created_at, email, signup_token, signed_up_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('prospects')
      .select('created_at, email, signup_token')
      .order('created_at', { ascending: false }),
  ])

  return (
    <AnalyticsClient
      hits={(hits ?? []) as AnalyticsRow[]}
      signups={(signups ?? []) as AnalyticsRow[]}
    />
  )
}
