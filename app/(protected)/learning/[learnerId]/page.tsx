import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, canSeePII } from '@/lib/auth'
import { maskName, maskEmail } from '@/lib/pii'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'
import InterventionPanel, { type Intervention, type StaffUser, type ActionItem, type UpdateLogEntry } from '@/components/learning/InterventionPanel'
import InterventionHistory, { type ClosedIntervention } from '@/components/learning/InterventionHistory'
import { type RawRow, type MetricDef, topoSortMetrics, computeAllForLearner } from '@/lib/learning/compute'
import { readSettings } from '@/lib/settings-server'

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

  const showPII     = canSeePII(appUser.role)
  const learnerUser = learner.users as unknown as { name: string; email: string } | null
  const realEmail   = learnerUser?.email?.trim().toLowerCase() ?? ''
  const name        = showPII ? (learnerUser?.name ?? learnerId) : maskName(learnerUser?.name, learnerId)
  const email       = showPII ? realEmail : maskEmail(realEmail)

  // Parallel fetches: metrics, raw rows, active intervention, closed history, staff users, settings
  const [
    { data: metricsRaw },
    { data: rawRowsData },
    { data: interventionRaw },
    { data: closedRaw },
    { data: staffRaw },
    settingsMap,
  ] = await Promise.all([
    supabase.from('metrics').select('*').order('created_at'),
    realEmail
      ? supabase
          .from('metric_raw_rows')
          .select('source_id, learner_id, dimensions, value')
          .eq('learner_id', realEmail)
          .limit(10000)
      : Promise.resolve({ data: [] }),
    supabase
      .from('interventions')
      .select('id, learner_id, status, flagged_items, what_wrong_notes, root_cause_categories, root_cause_notes, step1_completed_at, step2_completed_at, step3_completed_at, action_items, decision_date, last_reviewed_at, update_log')
      .eq('learner_id', learnerId)
      .neq('status', 'closed')
      .maybeSingle(),
    supabase
      .from('interventions')
      .select('id, status, root_cause_categories, root_cause_notes, action_items, update_log, outcome, outcome_note, closed_at, created_at, closed_by_user:users!interventions_closer_fkey(name)')
      .eq('learner_id', learnerId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false }),
    supabase.from('users').select('id, name, role').in('role', ['admin', 'staff']).order('name'),
    readSettings(['root_cause_categories', 'intervention_checklist_items']),
  ])

  const categories: string[] = (settingsMap['root_cause_categories'] as string[] | null) ?? [
    'Life circumstance',
    'Content difficulty',
    'Motivation / confidence',
    'External commitments',
    'Other',
  ]
  const checklistItems: string[] = (settingsMap['intervention_checklist_items'] as string[] | null) ?? [
    'Attendance',
    'Assignment completion',
    'Quiz / assessment scores',
    'Coding task progress',
    'Engagement / participation',
  ]

  const interventionHistory: ClosedIntervention[] = (closedRaw ?? []).map((iv) => ({
    id:                  iv.id,
    status:              'closed',
    root_cause_categories: ((iv as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? []),
    root_cause_notes:    iv.root_cause_notes ?? null,
    action_items:        (iv.action_items ?? []) as ActionItem[],
    update_log:          ((iv as unknown as { update_log?: unknown[] }).update_log ?? []) as UpdateLogEntry[],
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
        id:                   interventionRaw.id,
        learner_id:           interventionRaw.learner_id,
        status:               interventionRaw.status as Intervention['status'],
        flagged_items:        ((interventionRaw as unknown as { flagged_items?: string[] }).flagged_items ?? []),
        what_wrong_notes:     (interventionRaw as unknown as { what_wrong_notes?: string | null }).what_wrong_notes ?? null,
        root_cause_categories: ((interventionRaw as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? []),
        root_cause_notes:     interventionRaw.root_cause_notes ?? null,
        step1_completed_at:   interventionRaw.step1_completed_at ?? null,
        step2_completed_at:   interventionRaw.step2_completed_at ?? null,
        step3_completed_at:   (interventionRaw as unknown as { step3_completed_at?: string | null }).step3_completed_at ?? null,
        action_items:         (interventionRaw.action_items ?? []) as Intervention['action_items'],
        decision_date:        (interventionRaw as unknown as { decision_date: string | null }).decision_date ?? null,
        last_reviewed_at:     interventionRaw.last_reviewed_at ?? null,
        update_log:           ((interventionRaw as unknown as { update_log?: unknown[] }).update_log ?? []) as Intervention['update_log'],
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
      <InterventionPanel learnerId={learnerId} intervention={intervention} staffUsers={staffUsers} categories={categories} checklistItems={checklistItems} />

      {/* Past interventions history */}
      {interventionHistory.length > 0 && (
        <div className="mt-8">
          <InterventionHistory history={interventionHistory} />
        </div>
      )}
    </div>
  )
}
