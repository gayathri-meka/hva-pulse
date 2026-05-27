import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, canSeePII } from '@/lib/auth'
import { maskName, maskEmail } from '@/lib/pii'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'
import CasePanel, { type Case, type CaseTrigger, type StaffUser, type Intervention, type UpdateLogEntry } from '@/components/learning/CasePanel'
import CaseHistory, { type ClosedCase } from '@/components/learning/CaseHistory'
import { type Observation } from '@/components/learning/ObservationsModal'
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

  // Parallel fetches: metrics, raw rows, active cs, closed history, staff users, settings
  const [
    { data: metricsRaw },
    { data: rawRowsData },
    { data: caseRaw },
    { data: closedRaw },
    { data: staffRaw },
    settingsMap,
    { data: obsRaw },
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
      .from('cases')
      .select('id, learner_id, status, severity, accountable_team, flagged_items, what_wrong_notes, what_wrong_comments, root_cause_type, root_cause_categories, root_cause_notes, why_comments, step1_completed_at, step2_completed_at, step3_completed_at, interventions, decision_date, last_reviewed_at, update_log, created_at, closed_at, outcome, outcome_note')
      .eq('learner_id', learnerId)
      .neq('status', 'closed')
      .maybeSingle(),
    supabase
      .from('cases')
      .select('id, status, severity, accountable_team, flagged_items, what_wrong_notes, root_cause_type, root_cause_categories, root_cause_notes, interventions, update_log, outcome, outcome_note, decision_date, closed_at, created_at, closed_by_user:users!cases_closer_fkey(name)')
      .eq('learner_id', learnerId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false }),
    supabase.from('users').select('id, name, role').in('role', ['admin', 'staff']).order('name'),
    readSettings(['root_cause_categories', 'case_checklist_items']),
    supabase
      .from('learner_observations')
      .select('id, learner_id, author_id, observed_at, note, type, category, severity, accountable_team, author:users!learner_observations_author_id_fkey(name)')
      .eq('learner_id', learnerId)
      .order('observed_at', { ascending: false }),
  ])

  const observations: Observation[] = (obsRaw ?? []).map((o) => {
    const author = (o as unknown as { author: { name: string } | null }).author
    return {
      id:               o.id,
      learner_id:       o.learner_id,
      author_id:        o.author_id,
      author_name:      author?.name ?? null,
      observed_at:      o.observed_at,
      note:             o.note,
      type:             (o as unknown as { type:             string | null }).type             ?? null,
      category:         (o as unknown as { category:         string | null }).category         ?? null,
      severity:         (o as unknown as { severity:         string | null }).severity         ?? null,
      accountable_team: (o as unknown as { accountable_team: string | null }).accountable_team ?? null,
    }
  })

  const categories: string[] = (settingsMap['root_cause_categories'] as string[] | null) ?? [
    'Life circumstance',
    'Content difficulty',
    'Motivation / confidence',
    'External commitments',
    'Other',
  ]
  const checklistItems: string[] = (settingsMap['case_checklist_items'] as string[] | null) ?? [
    'Attendance',
    'Assignment completion',
    'Quiz / assessment scores',
    'Coding task progress',
    'Engagement / participation',
  ]

  // Batch-fetch triggers for every closed case so we don't do an N+1 round-trip.
  const closedIds = (closedRaw ?? []).map((r) => r.id)
  type RawClosedTrigger = {
    id:                  string
    case_id:             string
    kind:                'observation' | 'metric'
    metric_period_label: string | null
    metric_value:        number | null
    observation: { id: string; observed_at: string; note: string; type: string | null; severity: string | null } | null
    metric:      { id: string; name: string } | null
  }
  const triggersByCase = new Map<string, CaseTrigger[]>()
  if (closedIds.length > 0) {
    const { data: closedTrigsRaw } = await supabase
      .from('case_triggers')
      .select('id, case_id, kind, metric_period_label, metric_value, observation:learner_observations(id, observed_at, note, type, severity), metric:metrics(id, name)')
      .in('case_id', closedIds)
      .order('created_at', { ascending: true })
    for (const t of ((closedTrigsRaw ?? []) as unknown as RawClosedTrigger[])) {
      const trig: CaseTrigger = t.kind === 'observation'
        ? { id: t.id, kind: 'observation', observation: t.observation }
        : { id: t.id, kind: 'metric', metric: t.metric, metric_period_label: t.metric_period_label, metric_value: t.metric_value }
      if (!triggersByCase.has(t.case_id)) triggersByCase.set(t.case_id, [])
      triggersByCase.get(t.case_id)!.push(trig)
    }
  }

  const caseHistory: ClosedCase[] = (closedRaw ?? []).map((iv) => ({
    id:                    iv.id,
    status:                'closed',
    severity:              (iv as unknown as { severity:         ClosedCase['severity']         }).severity         ?? null,
    accountable_team:      (iv as unknown as { accountable_team: ClosedCase['accountable_team'] }).accountable_team ?? null,
    flagged_items:         ((iv as unknown as { flagged_items?: string[] }).flagged_items ?? []),
    what_wrong_notes:      (iv as unknown as { what_wrong_notes?: string | null }).what_wrong_notes ?? null,
    root_cause_type:       (iv as unknown as { root_cause_type?: ClosedCase['root_cause_type'] }).root_cause_type ?? null,
    root_cause_categories: ((iv as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? []),
    root_cause_notes:      iv.root_cause_notes ?? null,
    interventions:         (iv.interventions ?? []) as Intervention[],
    update_log:            ((iv as unknown as { update_log?: unknown[] }).update_log ?? []) as UpdateLogEntry[],
    outcome:               (iv.outcome ?? null) as ClosedCase['outcome'],
    outcome_note:          iv.outcome_note ?? null,
    decision_date:         (iv as unknown as { decision_date?: string | null }).decision_date ?? null,
    closed_at:             iv.closed_at ?? null,
    closed_by_name:        (iv.closed_by_user as unknown as { name: string } | null)?.name ?? null,
    opened_at:             iv.created_at ?? null,
    triggers:              triggersByCase.get(iv.id) ?? [],
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

  // Pull triggers for the active case in a second round-trip so we can join in
  // the observation snippet + metric name in one query.
  type RawTrigger = {
    id:                  string
    kind:                'observation' | 'metric'
    metric_period_label: string | null
    metric_value:        number | null
    observation: { id: string; observed_at: string; note: string; type: string | null; severity: string | null } | null
    metric:      { id: string; name: string } | null
  }
  const triggers: CaseTrigger[] = await (async () => {
    if (!caseRaw) return []
    const { data } = await supabase
      .from('case_triggers')
      .select('id, kind, metric_period_label, metric_value, observation:learner_observations(id, observed_at, note, type, severity), metric:metrics(id, name)')
      .eq('case_id', caseRaw.id)
      .order('created_at', { ascending: true })
    return ((data ?? []) as unknown as RawTrigger[]).map((t): CaseTrigger => {
      if (t.kind === 'observation') {
        return { id: t.id, kind: 'observation', observation: t.observation }
      }
      return {
        id:                  t.id,
        kind:                'metric',
        metric:              t.metric,
        metric_period_label: t.metric_period_label,
        metric_value:        t.metric_value,
      }
    })
  })()

  const cs: Case | null = caseRaw
    ? {
        id:                   caseRaw.id,
        learner_id:           caseRaw.learner_id,
        status:               caseRaw.status as Case['status'],
        severity:             (caseRaw as unknown as { severity:         Case['severity']         }).severity         ?? null,
        accountable_team:     (caseRaw as unknown as { accountable_team: Case['accountable_team'] }).accountable_team ?? null,
        flagged_items:        ((caseRaw as unknown as { flagged_items?: string[] }).flagged_items ?? []),
        what_wrong_notes:     (caseRaw as unknown as { what_wrong_notes?: string | null }).what_wrong_notes ?? null,
        what_wrong_comments:  ((caseRaw as unknown as { what_wrong_comments?: unknown[] }).what_wrong_comments ?? []) as Case['what_wrong_comments'],
        root_cause_type:      ((caseRaw as unknown as { root_cause_type?: 'time' | 'learning' | 'both' | 'other' | null }).root_cause_type) ?? null,
        root_cause_categories: ((caseRaw as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? []),
        root_cause_notes:     caseRaw.root_cause_notes ?? null,
        why_comments:         ((caseRaw as unknown as { why_comments?: unknown[] }).why_comments ?? []) as Case['why_comments'],
        step1_completed_at:   caseRaw.step1_completed_at ?? null,
        step2_completed_at:   caseRaw.step2_completed_at ?? null,
        step3_completed_at:   (caseRaw as unknown as { step3_completed_at?: string | null }).step3_completed_at ?? null,
        interventions:        (caseRaw.interventions ?? []) as Case['interventions'],
        decision_date:        (caseRaw as unknown as { decision_date: string | null }).decision_date ?? null,
        last_reviewed_at:     caseRaw.last_reviewed_at ?? null,
        update_log:           ((caseRaw as unknown as { update_log?: unknown[] }).update_log ?? []) as Case['update_log'],
        created_at:           (caseRaw as unknown as { created_at?: string | null }).created_at ?? null,
        closed_at:            (caseRaw as unknown as { closed_at?:  string | null }).closed_at  ?? null,
        outcome:              (caseRaw as unknown as { outcome?:    Case['outcome']            }).outcome    ?? null,
        outcome_note:         (caseRaw as unknown as { outcome_note?: string | null            }).outcome_note ?? null,
        triggers,
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

      {/* Case */}
      <CasePanel
        learnerId={learnerId}
        cs={cs}
        learner={{
          name,
          batch_name:     (learner as unknown as { batch_name: string | null }).batch_name ?? null,
          new_batch:      (learner as unknown as { new_batch: string | null }).new_batch ?? null,
          lf_name:        (learner as unknown as { lf_name:   string | null }).lf_name   ?? null,
          new_lf:         (learner as unknown as { new_lf:    string | null }).new_lf    ?? null,
          program_status: (learner as unknown as { status:    string | null }).status    ?? null,
        }}
        staffUsers={staffUsers}
        categories={categories}
        checklistItems={checklistItems}
        currentUserId={appUser.id}
        currentUserName={appUser.name ?? null}
        observationsForLearner={observations}
        metricOptions={metricDefs.map((m) => ({ id: m.id, name: m.name }))}
      />

      {/* Past cases history */}
      {caseHistory.length > 0 && (
        <div className="mt-8">
          <CaseHistory history={caseHistory} fallbackLearnerId={learnerId} />
        </div>
      )}
    </div>
  )
}
