import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import DataSourcesPanel from '@/components/learning/DataSourcesPanel'
import MetricsPanel from '@/components/learning/MetricsPanel'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function LearningSettingsPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/learning')

  const { tab = 'metrics' } = await searchParams
  const supabase = await createServerSupabaseClient()

  const [{ data: sources }, { data: metrics }] = await Promise.all([
    supabase.from('metric_sources').select('*, metric_source_columns(*)').order('created_at'),
    supabase.from('metrics').select('*').order('created_at'),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Learning</h1>
      </div>

      {/* Top-level tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        {[
          { key: 'all',           label: 'Dashboard',     href: '/learning?filter=all' },
          { key: 'interventions', label: 'Interventions', href: '/learning?filter=interventions' },
          { key: 'deep-dive',     label: 'Deep Dive',     href: '/learning/deep-dive' },
          { key: 'settings',      label: 'Settings',      href: '/learning/settings' },
        ].map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={`relative pb-3 px-1 mr-4 text-sm font-medium transition-colors ${
              key === 'settings' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {key === 'settings' && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
        ))}
      </div>

      {/* Settings sub-tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <nav className="flex gap-6">
          {[
            { key: 'metrics', label: 'Metrics' },
            { key: 'sources', label: 'Data Sources' },
          ].map(({ key, label }) => (
            <Link
              key={key}
              href={`/learning/settings?tab=${key}`}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                tab === key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
              {tab === key && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'sources' && (
        <DataSourcesPanel sources={sources ?? []} />
      )}
      {tab === 'metrics' && (
        <MetricsPanel metrics={metrics ?? []} sources={sources ?? []} />
      )}
    </div>
  )
}
