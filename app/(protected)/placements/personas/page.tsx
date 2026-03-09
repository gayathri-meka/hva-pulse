import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { JobPersona } from '@/types'
import PersonaCard from '@/components/outreach/PersonaCard'
import PersonaFormModal from '@/components/outreach/PersonaFormModal'
import RunScrapeButton from '@/components/outreach/RunScrapeButton'

export const dynamic = 'force-dynamic'

export default async function PersonasPage() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('job_personas')
    .select('*')
    .order('created_at', { ascending: false })

  const personas = (data ?? []) as JobPersona[]
  const active = personas.filter((p) => p.active)
  const inactive = personas.filter((p) => !p.active)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {active.length} active persona{active.length !== 1 ? 's' : ''}
            {inactive.length > 0 && ` · ${inactive.length} inactive`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RunScrapeButton />
          <PersonaFormModal />
        </div>
      </div>

      {personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
          <p className="text-sm font-medium text-zinc-500">No job personas yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create a persona to start discovering job opportunities</p>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Active</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((persona) => (
                  <PersonaCard key={persona.id} persona={persona} />
                ))}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Inactive</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inactive.map((persona) => (
                  <PersonaCard key={persona.id} persona={persona} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
