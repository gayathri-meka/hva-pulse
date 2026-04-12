import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'
import InterventionPanel, { type Intervention, type StaffUser, type ActionItem, type ReviewEntry } from '@/components/learning/InterventionPanel'
import InterventionHistory, { type ClosedIntervention } from '@/components/learning/InterventionHistory'
import { type RawRow, type MetricDef, topoSortMetrics, computeAllForLearner } from '@/lib/learning/compute'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ learnerId: string }>
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LearnerLearningPage({ params }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { learnerId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: learner } = await supabase
    .from('learners')
    .select('learner_id, lf_name, batch_name, track, status, new_lf, new_batch, users!learners_user_id_fkey(name, email)')
    .eq('learner_id', learnerId)
    .single()

  if (!learner) redirect('/learning')

  const learnerUser = learner.users as unknown as { name: string; email: string } | null
  const name        = learnerUser?.name ?? learnerId
  const email       = learnerUser?.email?.trim().toLowerCase() ?? ''

  // Parallel fetches: metrics, raw rows, active intervention, closed history, staff users
  const [
    { data: metricsRaw },
    { data: rawRowsData },
    { data: interventionRaw },
    { data: closedRaw },
    { data: staffRaw },
  ] = await Promise.all([
    supabase.from('metrics').select('*').order('created_at'),
    email
      ? supabase
          .from('metric_raw_rows')
          .select('source_id, learner_id, dimensions, value')
          .eq('learner_id', email)
          .limit(10000)
      : Promise.resolve({ data: [] }),
    supabase
      .from('interventions')
      .select('id, learner_id, status, root_cause_category, root_cause_notes, step1_completed_at, action_items, step2_completed_at, resurface_date, last_reviewed_at, reviews')
      .eq('learner_id', learnerId)
      .neq('status', 'closed')
      .maybeSingle(),
    supabase
      .from('interventions')
      .select('id, status, root_cause_category, root_cause_notes, action_items, reviews, outcome, outcome_note, closed_at, created_at, closed_by_user:users!interventions_closer_fkey(name)')
      .eq('learner_id', learnerId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false }),
    supabase.from('users').select('id, name, role').in('role', ['admin', 'staff']).order('name'),
  ])

  const interventionHistory: ClosedIntervention[] = (closedRaw ?? []).map((iv) => ({
    id:                  iv.id,
    status:              'closed',
    root_cause_category: iv.root_cause_category ?? null,
    root_cause_notes:    iv.root_cause_notes ?? null,
    action_items:        (iv.action_items ?? []) as ActionItem[],
    reviews:             (iv.reviews ?? []) as ReviewEntry[],
    outcome:             (iv.outcome ?? null) as ClosedIntervention['outcome'],
    outcome_note:        iv.outcome_note ?? null,
    closed_at:           iv.closed_at ?? null,
    closed_by_name:      (iv.closed_by_user as unknown as { name: string } | null)?.name ?? null,
    opened_at:           iv.created_at ?? null,
  }))

  const metricDefs: MetricDef[] = metricsRaw ?? []
  const staffUsers: StaffUser[] = (staffRaw ?? []) as StaffUser[]
  const rawRows: RawRow[] = (rawRowsData ?? []).map((r) => ({
    source_id:  r.source_id,
    learner_id: r.learner_id,
    dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
    value:      r.value,
  }))

  // Group raw rows by source for fast lookup
  const bySource = new Map<string, RawRow[]>()
  for (const row of rawRows) {
    if (!bySource.has(row.source_id)) bySource.set(row.source_id, [])
    bySource.get(row.source_id)!.push(row)
  }

  const ordered  = topoSortMetrics(metricDefs)
  const computed = computeAllForLearner(ordered, bySource)
  const metricRows: MetricRow[] = metricDefs.map((m) => ({
    id:       m.id,
    name:     m.name,
    computed: computed[m.id],
  }))

  const intervention: Intervention | null = interventionRaw
    ? {
        id:                  interventionRaw.id,
        learner_id:          interventionRaw.learner_id,
        status:              interventionRaw.status as Intervention['status'],
        root_cause_category: interventionRaw.root_cause_category ?? null,
        root_cause_notes:    interventionRaw.root_cause_notes ?? null,
        step1_completed_at:  interventionRaw.step1_completed_at ?? null,
        action_items:        (interventionRaw.action_items ?? []) as Intervention['action_items'],
        step2_completed_at:  interventionRaw.step2_completed_at ?? null,
        resurface_date:      interventionRaw.resurface_date ?? null,
        last_reviewed_at:    interventionRaw.last_reviewed_at ?? null,
        reviews:             (interventionRaw.reviews ?? []) as Intervention['reviews'],
      }
    : null

  const STATUS_BADGE: Record<string, string> = {
    Ongoing:         'bg-emerald-100 text-emerald-700',
    'On Hold':       'bg-orange-100 text-orange-700',
    Dropout:         'bg-red-100 text-red-700',
    Discontinued:    'bg-zinc-200 text-zinc-600',
    'Placed - Self': 'bg-blue-100 text-blue-700',
    'Placed - HVA':  'bg-violet-100 text-violet-700',
  }
  const status   = (learner as unknown as { status: string }).status ?? null
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="pb-32">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/learning" className="hover:text-zinc-700">Learning</Link>
        <span>/</span>
        <span>{name}</span>
      </div>

      {/* Learner info card */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-500">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{name}</h1>
              <p className="text-sm text-zinc-500">{email}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                <span className="font-mono">{learnerId}</span>
                {learner.batch_name && <span>{learner.batch_name}</span>}
                {learner.lf_name    && <span>LF: {learner.lf_name}</span>}
                {(learner as unknown as { new_batch: string | null }).new_batch && (
                  <span>New Batch: {(learner as unknown as { new_batch: string }).new_batch}</span>
                )}
                {(learner as unknown as { new_lf: string | null }).new_lf && (
                  <span>New LF: {(learner as unknown as { new_lf: string }).new_lf}</span>
                )}
                {learner.track      && <span>{learner.track}</span>}
              </div>
            </div>
          </div>
          {status && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      {metricRows.length > 0 && (
        <div className="mb-6">
          <MetricsSection metrics={metricRows} />
        </div>
      )}

      {/* Intervention */}
      <InterventionPanel learnerId={learnerId} intervention={intervention} staffUsers={staffUsers} />

      {/* Past interventions history */}
      {interventionHistory.length > 0 && (
        <div className="mt-8">
          <InterventionHistory history={interventionHistory} />
        </div>
      )}
    </div>
  )
}
