import { createClient } from '@supabase/supabase-js'
import { challengeFunnel, challengeEventDates, CHALLENGE_VIEW } from '@/lib/challengeFunnel'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
import AnalyticsClient from './AnalyticsClient'

export const dynamic = 'force-dynamic'

export type AnalyticsRow = {
  created_at:          string
  email:               string | null
  signup_token?:       string | null
  signed_up_at?:       string | null
  referral_source?:    string | null
  referral_detail?:    string | null
  educational_status?: string | null
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

  // PostgREST caps a single response at max-rows (1000), so .limit(20000) silently
  // truncates and the funnel undercounts. Page through with .range() to load every
  // (member, task) row — same pattern as the Admissions → Challenge tab.
  type RawRow = { learner_id: string | null; dimensions: Record<string, string | null> | null }
  async function fetchAllChallengeRows(sourceId: string): Promise<RawRow[]> {
    const PAGE = 1000
    const all: RawRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('metric_raw_rows')
        .select('learner_id, dimensions')
        .eq('source_id', sourceId)
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      all.push(...(data as RawRow[]))
      if (data.length < PAGE) break
    }
    return all
  }

  const [{ data: hits }, { data: signups }, challengeRows] = await Promise.all([
    supabase
      .from('learner_applications')
      .select('created_at, email, signup_token, signed_up_at, referral_source, referral_detail, educational_status')
      .order('created_at', { ascending: false }),
    supabase
      .from('prospects')
      // alias education_status → educational_status so both populations share AnalyticsRow
      .select('created_at, email, signup_token, referral_source, referral_detail, educational_status:education_status')
      .order('created_at', { ascending: false }),
    challengeSrc ? fetchAllChallengeRows(challengeSrc.id) : Promise.resolve([] as RawRow[]),
  ])

  const challenge = challengeFunnel(challengeRows)
  const challengeDates = challengeEventDates(challengeRows)

  return (
    <div>
      <AdmissionsSummary description="All the admissions data in one place — website applications and Pulse signups over time." />
      <AnalyticsClient
        hits={(hits ?? []) as AnalyticsRow[]}
        signups={(signups ?? []) as AnalyticsRow[]}
        challenge={challenge}
        challengeDates={challengeDates}
      />
    </div>
  )
}
