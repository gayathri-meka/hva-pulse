import { createClient } from '@supabase/supabase-js'
import { challengeFunnel, challengeEventDates, CHALLENGE_VIEW } from '@/lib/challengeFunnel'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
import AnalyticsClient from './AnalyticsClient'
import { computeCodingInterviewAnalytics, computeMotivationInterviewAnalytics } from '@/lib/interviewAnalytics'
import { fetchAllSupabaseRows } from '@/lib/fetchAllSupabaseRows'

export const dynamic = 'force-dynamic'

export type AnalyticsRow = {
  created_at:          string
  email:               string | null
  signup_token?:       string | null
  signed_up_at?:       string | null
  referral_source?:    string | null
  referral_detail?:    string | null
  educational_status?: string | null
  college?:            string | null
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
        // Stable sort REQUIRED — unordered offset pagination skips/duplicates rows
        // on large tables, undercounting the funnel.
        .order('id', { ascending: true })
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
      .select('created_at, email, signup_token, signed_up_at, referral_source, referral_detail, educational_status, college:college_name')
      .order('created_at', { ascending: false }),
    supabase
      .from('prospects')
      // alias education_status → educational_status so both populations share AnalyticsRow
      .select('created_at, email, signup_token, referral_source, referral_detail, educational_status:education_status, college')
      .order('created_at', { ascending: false }),
    challengeSrc ? fetchAllChallengeRows(challengeSrc.id) : Promise.resolve([] as RawRow[]),
  ])

  const challenge = challengeFunnel(challengeRows)
  const challengeDates = challengeEventDates(challengeRows)

  // Personal Interview analytics. Slot deletion is physical in the current
  // schema, so deleted slots never reach this calculation.
  const now = new Date()
  const nowIso = now.toISOString()
  const [{ count: selectedForInterviews }, interviewSlots, motivationInterviews, interviewDecisions] = await Promise.all([
    supabase.from('challenge_decisions').select('email', { count: 'exact', head: true }).eq('final_decision', 'selected').not('published_at', 'is', null),
    fetchAllSupabaseRows<{ id: string; round: number | null; starts_at: string; status: 'open' | 'booked' | 'blocked' }>(
      supabase.from('interview_slots')
        .select('id, round, starts_at, status')
        .eq('round', 1)
        .neq('status', 'blocked')
        .gte('starts_at', nowIso)
        .order('id') as never,
    ),
    fetchAllSupabaseRows<{
      candidate_email: string
      round: number
      slot_id: string | null
      scheduled_at: string
      status: 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
      recommendation: 'advance' | 'borderline' | 'no' | null
      assessed_at: string | null
    }>(
      supabase.from('interviews')
        .select('candidate_email, round, slot_id, scheduled_at, status, recommendation, assessed_at')
        .eq('round', 1)
        .order('id') as never,
    ),
    fetchAllSupabaseRows<{ candidate_email: string; final: 'selected' | 'rejected' | null }>(
      supabase.from('interview_decisions')
        .select('candidate_email, final')
        .order('candidate_email') as never,
    ),
  ])
  const motivationMetrics = computeMotivationInterviewAnalytics(
    interviewSlots.map((slot) => ({
      id: slot.id,
      round: slot.round,
      startsAt: slot.starts_at,
      status: slot.status,
    })),
    motivationInterviews.map((interview) => ({
      candidateEmail: interview.candidate_email,
      round: interview.round,
      slotId: interview.slot_id,
      scheduledAt: interview.scheduled_at,
      status: interview.status,
      recommendation: interview.recommendation,
      assessedAt: interview.assessed_at,
    })),
    now,
  )
  const codingMetrics = computeCodingInterviewAnalytics(
    interviewDecisions.map((decision) => ({
      candidateEmail: decision.candidate_email,
      final: decision.final,
    })),
    motivationMetrics.advanced,
  )

  return (
    <div>
      <AdmissionsSummary description="All the admissions data in one place — website applications and Pulse signups over time." />
      <AnalyticsClient
        hits={(hits ?? []) as AnalyticsRow[]}
        signups={(signups ?? []) as AnalyticsRow[]}
        challenge={challenge}
        challengeDates={challengeDates}
        interviews={{
          selectedForInterviews: selectedForInterviews ?? 0,
          ...motivationMetrics,
        }}
        coding={codingMetrics}
      />
    </div>
  )
}
