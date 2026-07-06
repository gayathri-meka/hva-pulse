import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import DataSourcesPanel from '@/components/learning/DataSourcesPanel'

export const dynamic = 'force-dynamic'

export default async function DataSourcesSettingsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role === 'learner') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()
  const { data: sources } = await supabase
    .from('metric_sources')
    .select('*, metric_source_columns(*)')
    .order('created_at')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Data Sources</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect Google Sheets and BigQuery views that feed metrics, the challenge tabs, and reviews.
        </p>
      </div>

      <div className={appUser.role !== 'admin' ? 'guest-readonly' : ''}>
        <DataSourcesPanel sources={sources ?? []} />
      </div>
    </div>
  )
}
