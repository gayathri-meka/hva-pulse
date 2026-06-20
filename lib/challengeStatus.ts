import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CHALLENGE_VIEW,
  challengeStatusByEmail,
  type ChallengeRawRow,
  type ChallengeStatus,
} from './challengeFunnel'

export type { ChallengeStatus }

// Fetches every "Challenge Completion" synced row (one per member×task) from
// metric_raw_rows. PostgREST caps a single response at 1000 rows, so a bare
// .limit() silently truncates and any downstream funnel undercounts — page
// through with .range() instead. Returns [] if the source isn't connected.
//
// This is the single source of truth for loading challenge rows; the dashboard,
// Admissions → Analytics, and the per-email status map all use it.
export async function fetchChallengeRawRows(supabase: SupabaseClient): Promise<ChallengeRawRow[]> {
  const { data: src } = await supabase
    .from('metric_sources')
    .select('id')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()
  if (!src) return []

  const PAGE = 1000
  const rows: ChallengeRawRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('metric_raw_rows')
      .select('learner_id, dimensions')
      .eq('source_id', src.id)
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    rows.push(...(data as ChallengeRawRow[]))
    if (data.length < PAGE) break
  }
  return rows
}

// Map of normalised email -> challenge status. Emails absent from the map are
// 'Not joined'. Used to add a "Challenge" column to the Prospects and Website
// Hits tables — joined to those rows by email (see challengeStatusByEmail).
export async function fetchChallengeStatusByEmail(
  supabase: SupabaseClient,
): Promise<Map<string, ChallengeStatus>> {
  return challengeStatusByEmail(await fetchChallengeRawRows(supabase))
}
