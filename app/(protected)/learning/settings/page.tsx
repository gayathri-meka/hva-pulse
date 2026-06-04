import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import DataSourcesPanel from '@/components/learning/DataSourcesPanel'
import MetricsPanel from '@/components/learning/MetricsPanel'
import LearningConfigurationsPanel from '@/components/learning/LearningConfigurationsPanel'
import LearningTabs from '@/components/learning/LearningTabs'
import { topLevelLearningTabs } from '@/lib/learning/tabs'
import { readSettings } from '@/lib/settings-server'
import { DEFAULT_OBSERVATION_CATEGORIES } from '@/lib/learning/observation-vocab'

export const dynamic = 'force-dynamic'

const DEFAULT_CATEGORIES = [
  'Life circumstance',
  'Content difficulty',
  'Motivation / confidence',
  'External commitments',
  'Other',
]

const DEFAULT_CHECKLIST_ITEMS = [
  'Attendance',
  'Assignment completion',
  'Quiz / assessment scores',
  'Coding task progress',
  'Engagement / participation',
]

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function LearningSettingsPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role === 'learner') redirect('/learning')

  const { tab = 'metrics' } = await searchParams
  const supabase = await createServerSupabaseClient()

  const [{ data: sources }, { data: metrics }, settingsMap] = await Promise.all([
    supabase.from('metric_sources').select('*, metric_source_columns(*)').order('created_at'),
    supabase.from('metrics').select('*').order('created_at'),
    readSettings(['root_cause_categories', 'case_checklist_items', 'observation_categories']),
  ])

  const categories: string[]            = (settingsMap['root_cause_categories']  as string[] | null) ?? DEFAULT_CATEGORIES
  const checklistItems: string[]        = (settingsMap['case_checklist_items'] as string[] | null) ?? DEFAULT_CHECKLIST_ITEMS
  const observationCategories: string[] = (settingsMap['observation_categories'] as string[] | null) ?? DEFAULT_OBSERVATION_CATEGORIES

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Learning</h1>
      </div>

      {/* Top-level tabs */}
      <LearningTabs activeKey="settings" tabs={topLevelLearningTabs({ role: appUser.role })} />

      {/* Settings sub-tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <nav className="flex gap-6">
          {[
            { key: 'metrics',        label: 'Metrics' },
            { key: 'sources',        label: 'Data Sources' },
            { key: 'configurations', label: 'Configurations' },
          ].map(({ key, label }) => (
            <Link
              key={key}
              href={`/learning/settings?tab=${key}`}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                (tab === key || (key === 'configurations' && tab === 'categories')) ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
              {(tab === key || (key === 'configurations' && tab === 'categories')) && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
            </Link>
          ))}
        </nav>
      </div>

      <div className={appUser.role !== 'admin' ? 'guest-readonly' : ''}>
        {tab === 'sources' && (
          <DataSourcesPanel sources={sources ?? []} />
        )}
        {tab === 'metrics' && (
          <MetricsPanel metrics={metrics ?? []} sources={sources ?? []} />
        )}
        {(tab === 'configurations' || tab === 'categories') && (
          <LearningConfigurationsPanel
            categories={categories}
            checklistItems={checklistItems}
            observationCategories={observationCategories}
          />
        )}
      </div>
    </div>
  )
}
