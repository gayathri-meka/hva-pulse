import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { JobOpportunityWithPersona, JobPersona } from '@/types'
import OpportunitiesClient from '@/components/outreach/OpportunitiesClient'

export const dynamic = 'force-dynamic'

export default async function OpportunitiesPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: rawData }, { data: personasData }] = await Promise.all([
    supabase
      .from('job_opportunities')
      .select('*, job_personas(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('job_personas')
      .select('id, name')
      .order('name'),
  ])

  const opportunities: JobOpportunityWithPersona[] = (rawData ?? []).map((row) => {
    const { job_personas, ...rest } = row as { job_personas: { name: string } | null; [key: string]: unknown }
    return {
      ...(rest as Omit<JobOpportunityWithPersona, 'persona_name'>),
      persona_name: job_personas?.name ?? null,
    }
  })

  const personas = (personasData ?? []) as Pick<JobPersona, 'id' | 'name'>[]

  return <OpportunitiesClient opportunities={opportunities} personas={personas} />
}
