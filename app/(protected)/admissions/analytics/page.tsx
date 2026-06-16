import { createClient } from '@supabase/supabase-js'
import { challengeFunnel, CHALLENGE_VIEW } from '@/lib/challengeFunnel'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
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

  const { data: challengeSrc } = await supabase
    .from('metric_sources')
    .select('id')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()

  const [{ data: hits }, { data: signups }, { data: challengeRows }] = await Promise.all([
    supabase
      .from('learner_applications')
      .select('created_at, email, signup_token, signed_up_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('prospects')
      .select('created_at, email, signup_token')
      .order('created_at', { ascending: false }),
    challengeSrc
      ? supabase.from('metric_raw_rows').select('learner_id, dimensions').eq('source_id', challengeSrc.id).limit(20000)
      : Promise.resolve({ data: [] as { learner_id: string | null; dimensions: Record<string, string | null> | null }[] }),
  ])

  const challenge = challengeFunnel(challengeRows ?? [])

  return (
    <div>
      <AdmissionsSummary
        description="All the admissions data in one place — website applications and Pulse signups over time."
        stats={[
          { value: (hits ?? []).length, label: 'website applications' },
          { value: (signups ?? []).length, label: 'Pulse signups' },
        ]}
      />
      <AnalyticsClient
        hits={(hits ?? []) as AnalyticsRow[]}
        signups={(signups ?? []) as AnalyticsRow[]}
        challenge={challenge}
      />
    </div>
  )
}
