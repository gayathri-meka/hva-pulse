import type { SupabaseClient } from '@supabase/supabase-js'
import { CHALLENGE_VIEW, challengeStatusByEmail, type ChallengeStatus } from './challengeFunnel'

export type { ChallengeStatus }

// Fetches the "Challenge Completion" synced rows and returns a map of
// normalised email -> challenge status. Emails absent from the map are
// 'Not joined'. Returns an empty map if the source isn't connected yet.
//
// Used to add a "Challenge" column to the Prospects and Website Hits tables —
// joined to those rows by email (see challengeStatusByEmail).
export async function fetchChallengeStatusByEmail(
  supabase: SupabaseClient,
): Promise<Map<string, ChallengeStatus>> {
  const { data: src } = await supabase
    .from('metric_sources')
    .select('id')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()
  if (!src) return new Map()

  // PostgREST caps a single response at 1000 rows — page through with .range().
  const PAGE = 1000
  const rows: { learner_id: string | null; dimensions: Record<string, string | null> | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('metric_raw_rows')
      .select('learner_id, dimensions')
      .eq('source_id', src.id)
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    rows.push(...(data as typeof rows))
    if (data.length < PAGE) break
  }

  return challengeStatusByEmail(rows)
}
