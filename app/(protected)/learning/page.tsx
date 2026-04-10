import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import LearningDashboard, {
  type LearnerRow,
  type MetricCol,
} from '@/components/learning/LearningDashboard'
import InterventionPanel, { type Intervention, type StaffUser, type ActionItem, type ReviewEntry } from '@/components/learning/InterventionPanel'
import LearnerSearchBox from '@/components/learning/LearnerSearchBox'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'
import InterventionsTable, { type InterventionRow } from '@/components/learning/InterventionsTable'
import InterventionHistory, { type ClosedIntervention } from '@/components/learning/InterventionHistory'
import {
  type RawRow,
  type MetricDef,
  topoSortMetrics,
  computeAllForLearner,
} from '@/lib/learning/compute'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ filter?: string; lf?: string; sub_cohort?: string; learner?: string; view?: string }>
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LearningPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { filter = 'all', lf, sub_cohort, learner: selectedLearnerId, view: interventionView = 'table' } = await searchParams
  const subCohorts = sub_cohort ? sub_cohort.split(',').filter(Boolean) : []
  const supabase = await createServerSupabaseClient()
  const isLF = appUser.role === 'LF'

  // Learners (active cohort, with email via users join)
  const learnersQuery = (() => {
    let q = supabase
      .from('learners')
      .select('learner_id, lf_name, lf_user_id, batch_name, sub_cohort, status, new_lf, new_batch, new_mentor, users!learners_user_id_fkey(name, email)')
      .eq('is_current_cohort', true)
      .order('lf_name')
    if (isLF)            q = q.eq('lf_user_id', appUser.id)
    else if (lf)         q = q.eq('lf_name', lf)
    if (subCohorts.length) q = q.in('sub_cohort', subCohorts)
    return q
  })()

  // Fetch all learners for sub_cohort pill options (unfiltered)
  const [
    { data: learnersRaw },
    { data: metricsRaw },
    { data: allLearners },
    { data: interventionsRaw },
  ] = await Promise.all([
    learnersQuery,
    supabase.from('metrics').select('*').order('created_at'),
    supabase.from('learners').select('sub_cohort').eq('is_current_cohort', true),
    supabase.from('interventions').select('id, learner_id, status, resurface_date').neq('status', 'closed'),
  ])

  const interventionMap = new Map(
    (interventionsRaw ?? []).map((iv) => [iv.learner_id, iv as { id: string; learner_id: string; status: string; resurface_date: string | null }])
  )

  const subCohortOptions = Array.from(
    new Set((allLearners ?? []).map((l) => l.sub_cohort).filter(Boolean))
  ).sort() as string[]

  const learners  = learnersRaw ?? []
  const metricDefs: MetricDef[] = metricsRaw ?? []

  // Compute metric values for every learner
  let learnerRows: LearnerRow[] = []

  if (filter === 'all' && metricDefs.length > 0) {
    const emails = learners
      .map((l) => (l.users as unknown as { email: string } | null)?.email?.trim().toLowerCase())
      .filter((e): e is string => !!e)

    const sourceIds = [...new Set(metricDefs.map((m) => m.source_id).filter((s): s is string => !!s))]
    const metricsInOrder = topoSortMetrics(metricDefs)

    // Fetch all raw rows in pages — Supabase caps single queries at db.max_rows (default 1000)
    const PAGE = 1000
    const rawRowsData: { source_id: string; learner_id: string; dimensions: unknown; value: string | null }[] = []
    if (sourceIds.length > 0) {
      let offset = 0
      while (true) {
        const { data: page } = await supabase
          .from('metric_raw_rows')
          .select('source_id, learner_id, dimensions, value')
          .in('source_id', sourceIds)
          .in('learner_id', emails)
          .range(offset, offset + PAGE - 1)
        if (!page || page.length === 0) break
        rawRowsData.push(...page)
        if (page.length < PAGE) break
        offset += PAGE
      }
    }

    const rawRows: RawRow[] = rawRowsData.map((r) => ({
      source_id:  r.source_id,
      learner_id: r.learner_id,
      dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
      value:      r.value,
    }))

    // Group raw rows by source → learner for fast lookup
    const bySourceLearner = new Map<string, RawRow[]>()
    for (const row of rawRows) {
      const key = `${row.source_id}::${row.learner_id}`
      if (!bySourceLearner.has(key)) bySourceLearner.set(key, [])
      bySourceLearner.get(key)!.push(row)
    }

    learnerRows = learners.map((l) => {
      const user  = l.users as unknown as { name: string; email: string } | null
      const email = user?.email?.trim().toLowerCase() ?? ''
      const name  = user?.name ?? l.learner_id

      // For each metric source, isolate this learner's rows
      const rowsBySource = new Map<string, RawRow[]>()
      for (const sid of sourceIds) {
        rowsBySource.set(sid, bySourceLearner.get(`${sid}::${email}`) ?? [])
      }
      const metrics = computeAllForLearner(metricsInOrder, rowsBySource)

      return {
        learner_id:   l.learner_id,
        name,
        lf_name:      l.lf_name ?? null,
        batch_name:   l.batch_name ?? null,
        status:       (l as unknown as { status: string }).status ?? null,
        new_lf:       (l as unknown as { new_lf: string | null }).new_lf ?? null,
        new_batch:    (l as unknown as { new_batch: string | null }).new_batch ?? null,
        new_mentor:   (l as unknown as { new_mentor: string | null }).new_mentor ?? null,
        metrics,
        intervention: interventionMap.get(l.learner_id) ?? null,
      }
    })
  } else if (filter === 'all') {
    // No metrics defined — still show learner list (empty metric columns)
    learnerRows = learners.map((l) => {
      const user = l.users as unknown as { name: string; email: string } | null
      return {
        learner_id:   l.learner_id,
        name:         user?.name ?? l.learner_id,
        lf_name:      l.lf_name ?? null,
        batch_name:   l.batch_name ?? null,
        status:       (l as unknown as { status: string }).status ?? null,
        new_lf:       (l as unknown as { new_lf: string | null }).new_lf ?? null,
        new_batch:    (l as unknown as { new_batch: string | null }).new_batch ?? null,
        new_mentor:   (l as unknown as { new_mentor: string | null }).new_mentor ?? null,
        metrics:      {},
        intervention: interventionMap.get(l.learner_id) ?? null,
      }
    })
  }

  // Sort: "Needs review" (monitoring + overdue) first, then other active, then no intervention
  const today = new Date().toISOString().slice(0, 10)
  learnerRows.sort((a, b) => {
    const score = (iv: LearnerRow['intervention']) => {
      if (!iv) return 3
      if (iv.status === 'monitoring' && iv.resurface_date && iv.resurface_date <= today) return 0
      if (iv.status === 'monitoring') return 1
      return 2
    }
    return score(a.intervention) - score(b.intervention)
  })

  const metricCols: MetricCol[] = metricDefs.map((m) => ({
    id:            m.id,
    name:          m.name,
    is_time_series: !!m.time_dimension,
  }))

  // ── Interventions tab data ─────────────────────────────────────────────────
  type CohortLearner = { learner_id: string; name: string; email: string }
  type SelectedLearnerData = {
    learner_id: string; name: string; email: string
    batch_name: string | null; lf_name: string | null; status: string | null
    new_lf: string | null; new_batch: string | null
  }

  let cohortLearners: CohortLearner[] = []
  let staffUsers: StaffUser[] = []
  let selectedLearnerData: SelectedLearnerData | null = null
  let selectedIntervention: Intervention | null = null
  let selectedMetricRows: MetricRow[] = []
  let selectedHistory: ClosedIntervention[] = []
  let interventionRows: InterventionRow[] = []

  if (filter === 'interventions') {
    const [{ data: allCohort }, { data: staff }] = await Promise.all([
      supabase
        .from('learners')
        .select('learner_id, users!learners_user_id_fkey(name, email)')
        .eq('is_current_cohort', true)
        .order('lf_name'),
      supabase.from('users').select('id, name, role').in('role', ['admin', 'LF']).order('name'),
    ])

    cohortLearners = (allCohort ?? []).map((l) => {
      const u = l.users as unknown as { name: string; email: string } | null
      return { learner_id: l.learner_id, name: u?.name ?? l.learner_id, email: u?.email ?? '' }
    })
    staffUsers = (staff ?? []) as StaffUser[]

    if (interventionView === 'table') {
      const { data: ivRows } = await supabase
        .from('interventions')
        .select('id, learner_id, status, root_cause_category, action_items, resurface_date')
        .neq('status', 'closed')
        .order('resurface_date', { ascending: true, nullsFirst: false })

      const learnerNameById = new Map(cohortLearners.map((l) => [l.learner_id, l.name]))
      interventionRows = (ivRows ?? []).map((iv) => {
        const items = (iv.action_items ?? []) as ActionItem[]
        return {
          id:                 iv.id,
          learner_id:         iv.learner_id,
          learner_name:       learnerNameById.get(iv.learner_id) ?? iv.learner_id,
          status:             iv.status as InterventionRow['status'],
          root_cause_filled:  !!iv.root_cause_category,
          total_action_items: items.length,
          done_action_items:  items.filter((it) => !!it.completed_at).length,
          resurface_date:     iv.resurface_date ?? null,
        }
      })
    }

    if (selectedLearnerId) {
      const [{ data: sl }, { data: iv }, { data: closedRaw }] = await Promise.all([
        supabase
          .from('learners')
          .select('learner_id, lf_name, batch_name, status, new_lf, new_batch, users!learners_user_id_fkey(name, email)')
          .eq('learner_id', selectedLearnerId)
          .single(),
        supabase
          .from('interventions')
          .select('id, learner_id, status, root_cause_category, root_cause_notes, step1_completed_at, action_items, step2_completed_at, resurface_date, last_reviewed_at, reviews')
          .eq('learner_id', selectedLearnerId)
          .neq('status', 'closed')
          .maybeSingle(),
        supabase
          .from('interventions')
          .select('id, status, root_cause_category, root_cause_notes, action_items, reviews, outcome, outcome_note, closed_at, created_at, closed_by_user:users!interventions_closer_fkey(name)')
          .eq('learner_id', selectedLearnerId)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false }),
      ])

      selectedHistory = (closedRaw ?? []).map((iv) => ({
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

      if (sl) {
        const u = sl.users as unknown as { name: string; email: string } | null
        const slEmail = u?.email?.trim().toLowerCase() ?? ''
        selectedLearnerData = {
          learner_id: sl.learner_id,
          name:       u?.name ?? sl.learner_id,
          email:      slEmail,
          batch_name: sl.batch_name ?? null,
          lf_name:    sl.lf_name ?? null,
          status:     (sl as unknown as { status: string }).status ?? null,
          new_lf:     (sl as unknown as { new_lf: string | null }).new_lf ?? null,
          new_batch:  (sl as unknown as { new_batch: string | null }).new_batch ?? null,
        }

        // Fetch + compute metrics for this learner
        if (slEmail && metricDefs.length > 0) {
          const { data: rawRowsData } = await supabase
            .from('metric_raw_rows')
            .select('source_id, learner_id, dimensions, value')
            .eq('learner_id', slEmail)
            .limit(10000)

          const rawRows: RawRow[] = (rawRowsData ?? []).map((r) => ({
            source_id:  r.source_id,
            learner_id: r.learner_id,
            dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
            value:      r.value,
          }))
          const bySource = new Map<string, RawRow[]>()
          for (const row of rawRows) {
            if (!bySource.has(row.source_id)) bySource.set(row.source_id, [])
            bySource.get(row.source_id)!.push(row)
          }
          const ordered = topoSortMetrics(metricDefs)
          const computed = computeAllForLearner(ordered, bySource)
          selectedMetricRows = metricDefs.map((m) => ({
            id:       m.id,
            name:     m.name,
            computed: computed[m.id],
          }))
        }
      }

      if (iv) {
        selectedIntervention = {
          id:                  iv.id,
          learner_id:          iv.learner_id,
          status:              iv.status as Intervention['status'],
          root_cause_category: iv.root_cause_category ?? null,
          root_cause_notes:    iv.root_cause_notes ?? null,
          step1_completed_at:  iv.step1_completed_at ?? null,
          action_items:        (iv.action_items ?? []) as Intervention['action_items'],
          step2_completed_at:  iv.step2_completed_at ?? null,
          resurface_date:      iv.resurface_date ?? null,
          last_reviewed_at:    iv.last_reviewed_at ?? null,
          reviews:             (iv.reviews ?? []) as Intervention['reviews'],
        }
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Learning</h1>
      </div>

      {/* Top-level tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        {[
          { key: 'all',           label: 'Dashboard',     href: `/learning?filter=all${lf ? `&lf=${lf}` : ''}` },
          { key: 'interventions', label: 'Interventions', href: `/learning?filter=interventions${lf ? `&lf=${lf}` : ''}` },
          ...(appUser.role === 'admin' ? [{ key: 'settings', label: 'Settings', href: '/learning/settings' }] : []),
        ].map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={`relative pb-3 px-1 mr-4 text-sm font-medium transition-colors ${
              filter === key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {filter === key && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
        ))}
      </div>

      {filter === 'all' && (
        <LearningDashboard learners={learnerRows} metrics={metricCols} subCohortOptions={subCohortOptions} />
      )}

      {filter === 'interventions' && (
        <div className="space-y-6 pb-32">
          {/* Sub-tabs: Learner-wise | Table view */}
          <div className="flex items-center gap-1 border-b border-zinc-200">
            {[
              { key: 'table',   label: 'Table view'  },
              { key: 'learner', label: 'Learner-wise' },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/learning?filter=interventions&view=${key}`}
                className={`relative pb-2.5 px-1 mr-4 text-sm font-medium transition-colors ${
                  interventionView === key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
                {interventionView === key && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
              </Link>
            ))}
          </div>

          {interventionView === 'learner' && (
            <>
              {/* Learner search */}
              <LearnerSearchBox learners={cohortLearners} selectedId={selectedLearnerId ?? null} />

              {/* Selected learner view */}
              {selectedLearnerData && (
                <div className="space-y-6">
                  <LearnerInfoCard learner={selectedLearnerData} />

                  {selectedMetricRows.length > 0 && (
                    <MetricsSection metrics={selectedMetricRows} />
                  )}

                  <InterventionPanel
                    learnerId={selectedLearnerData.learner_id}
                    intervention={selectedIntervention}
                    staffUsers={staffUsers}
                  />

                  {selectedHistory.length > 0 && (
                    <InterventionHistory history={selectedHistory} />
                  )}
                </div>
              )}

              {!selectedLearnerId && (
                <p className="text-sm text-zinc-400">Select a learner to view or start an intervention.</p>
              )}
            </>
          )}

          {interventionView === 'table' && (
            <InterventionsTable rows={interventionRows} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Learner info card ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

function LearnerInfoCard({ learner }: {
  learner: {
    learner_id: string; name: string; email: string
    batch_name: string | null; lf_name: string | null; status: string | null
    new_lf: string | null; new_batch: string | null
  }
}) {
  const initials = learner.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-500">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">{learner.name}</h2>
            <p className="text-sm text-zinc-500">{learner.email}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
              <span className="font-mono">{learner.learner_id}</span>
              {learner.batch_name && <span>{learner.batch_name}</span>}
              {learner.lf_name    && <span>LF: {learner.lf_name}</span>}
              {learner.new_batch  && <span>New Batch: {learner.new_batch}</span>}
              {learner.new_lf     && <span>New LF: {learner.new_lf}</span>}
            </div>
          </div>
        </div>
        {learner.status && (
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {learner.status}
          </span>
        )}
      </div>
    </div>
  )
}
