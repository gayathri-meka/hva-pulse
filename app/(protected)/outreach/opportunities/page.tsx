import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { JobOpportunityWithPersona, JobPersona } from '@/types'
import OpportunitiesClient from '@/components/outreach/OpportunitiesClient'

export const dynamic = 'force-dynamic'

type SearchParams = {
  persona?: string
  source?: string
  status?: string
  from?: string
  to?: string
  id?: string
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('job_opportunities')
    .select('*, job_personas(name)')
    .order('created_at', { ascending: false })

  if (params.persona) query = query.eq('persona_id', params.persona)
  if (params.source) query = query.eq('source_platform', params.source)
  if (params.status) query = query.eq('status', params.status)
  if (params.from) query = query.gte('date_posted', params.from)
  if (params.to) query = query.lte('date_posted', params.to)

  const { data: rawData } = await query

  const opportunities: JobOpportunityWithPersona[] = (rawData ?? []).map((row) => {
    const { job_personas, ...rest } = row as {
      job_personas: { name: string } | null
      [key: string]: unknown
    }
    return {
      ...(rest as Omit<JobOpportunityWithPersona, 'persona_name'>),
      persona_name: job_personas?.name ?? null,
    }
  })

  const { data: personasData } = await supabase
    .from('job_personas')
    .select('id, name')
    .order('name')

  const personas = (personasData ?? []) as Pick<JobPersona, 'id' | 'name'>[]

  return (
    <OpportunitiesClient
      opportunities={opportunities}
      personas={personas}
      activeFilters={params}
      selectedId={params.id}
    />
  )
}
