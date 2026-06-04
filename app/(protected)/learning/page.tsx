import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, canSeePII } from '@/lib/auth'
import { maskName, maskEmail } from '@/lib/pii'
import LearningDashboard, {
  type LearnerRow,
  type MetricCol,
} from '@/components/learning/LearningDashboard'
import CasePanel, { type Case, type CaseTrigger, type StaffUser, type Intervention, type UpdateLogEntry } from '@/components/learning/CasePanel'
import LearnerSearchBox from '@/components/learning/LearnerSearchBox'
import { type MetricRow } from '@/components/learning/MetricsSection'
import CasesTable, { type CaseRow } from '@/components/learning/CasesTable'
import CaseHistory, { type ClosedCase } from '@/components/learning/CaseHistory'
import ClosedCasesTable from '@/components/learning/ClosedCasesTable'
import { type Observation } from '@/components/learning/ObservationsModal'
import LearningTabs from '@/components/learning/LearningTabs'
import {
  type RawRow,
  type MetricDef,
  topoSortMetrics,
  computeAllForLearner,
} from '@/lib/learning/compute'
import { readSettings } from '@/lib/settings-server'
import { DEFAULT_OBSERVATION_CATEGORIES } from '@/lib/learning/observation-vocab'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ filter?: string; lf?: string; sub_cohort?: string; learner?: string; view?: string }>
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LearningPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { filter = 'all', lf, sub_cohort, learner: selectedLearnerId, view: caseView = 'table' } = await searchParams
  const showPII = canSeePII(appUser.role)
  const subCohorts = sub_cohort ? sub_cohort.split(',').filter(Boolean) : []
  const supabase = await createServerSupabaseClient()
  // Learners (active cohort, with email via users join)
  const learnersQuery = (() => {
    let q = supabase
      .from('learners')
      .select('learner_id, lf_name, lf_user_id, batch_name, sub_cohort, status, new_lf, new_batch, new_mentor, users!learners_user_id_fkey(name, email)')
      .eq('is_current_cohort', true)
      .order('lf_name')
    if (lf)              q = q.eq('lf_name', lf)
    if (subCohorts.length) q = q.in('sub_cohort', subCohorts)
    return q
  })()

  // Fetch all learners for sub_cohort pill options (unfiltered)
  const [
    { data: learnersRaw },
    { data: metricsRaw },
    { data: allLearners },
    { data: casesRaw },
    { data: observationsRaw },
    pageSettings,
  ] = await Promise.all([
    learnersQuery,
    supabase.from('metrics').select('*').order('created_at'),
    supabase.from('learners').select('sub_cohort').eq('is_current_cohort', true),
    supabase.from('cases').select('id, learner_id, status, decision_date, outcome, closed_at, step1_completed_at, step2_completed_at, step3_completed_at'),
    supabase
      .from('learner_observations')
      .select('id, learner_id, author_id, observed_at, note, type, category, severity, accountable_team, author:users!learner_observations_author_id_fkey(name)')
      .order('observed_at', { ascending: false }),
    readSettings(['observation_categories']),
  ])

  const observationCategories: string[] =
    (pageSettings['observation_categories'] as string[] | null) ?? DEFAULT_OBSERVATION_CATEGORIES

  const observationsByLearner = new Map<string, Observation[]>()
  for (const o of observationsRaw ?? []) {
    const author = (o as unknown as { author: { name: string } | null }).author
    const obs: Observation = {
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
    if (!observationsByLearner.has(o.learner_id)) observationsByLearner.set(o.learner_id, [])
    observationsByLearner.get(o.learner_id)!.push(obs)
  }

  // Build a per-learner cs map. Active (non-closed) always wins.
  // For closed cases: only "resolved" outcomes are kept (so admins see
  // "Resolved" badges); other closed outcomes (dropped/other) are hidden
  // — the learner reads as "no cs" again.
  type CaseMapEntry = {
    id: string; learner_id: string; status: string
    decision_date: string | null
    outcome: string | null
    closed_at: string | null
    step1_completed_at: string | null
    step2_completed_at: string | null
    step3_completed_at: string | null
  }
  const relevantCases = (casesRaw ?? [])
    .filter((iv) => iv.status !== 'closed' || iv.outcome === 'resolved') as CaseMapEntry[]
  const sortedCases = [...relevantCases].sort((a, b) => {
    const aClosed = a.status === 'closed'
    const bClosed = b.status === 'closed'
    if (aClosed && !bClosed) return -1   // closed first → active overwrites in last-wins
    if (!aClosed && bClosed) return 1
    if (aClosed && bClosed)  return (a.closed_at ?? '').localeCompare(b.closed_at ?? '') // older first → newest wins
    return 0
  })
  const caseMap = new Map(
    sortedCases.map((iv) => [iv.learner_id, iv])
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
      const name  = showPII ? (user?.name ?? l.learner_id) : maskName(user?.name, l.learner_id)

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
        observations: observationsByLearner.get(l.learner_id) ?? [],
        cs: caseMap.get(l.learner_id) ?? null,
      }
    })
  } else if (filter === 'all') {
    // No metrics defined — still show learner list (empty metric columns)
    learnerRows = learners.map((l) => {
      const user = l.users as unknown as { name: string; email: string } | null
      return {
        learner_id:   l.learner_id,
        name:         showPII ? (user?.name ?? l.learner_id) : maskName(user?.name, l.learner_id),
        lf_name:      l.lf_name ?? null,
        batch_name:   l.batch_name ?? null,
        status:       (l as unknown as { status: string }).status ?? null,
        new_lf:       (l as unknown as { new_lf: string | null }).new_lf ?? null,
        new_batch:    (l as unknown as { new_batch: string | null }).new_batch ?? null,
        new_mentor:   (l as unknown as { new_mentor: string | null }).new_mentor ?? null,
        metrics:      {},
        observations: observationsByLearner.get(l.learner_id) ?? [],
        cs: caseMap.get(l.learner_id) ?? null,
      }
    })
  }

  // Sort: "Needs review" first (overdue → action needed), then active, then closed, then no cs.
  // Uses step-completion timestamps (same as the badge label) so it stays in sync with what the user sees.
  const today = new Date().toISOString().slice(0, 10)
  learnerRows.sort((a, b) => {
    const score = (iv: LearnerRow['cs']) => {
      if (!iv) return 5
      if (iv.status === 'closed') return 4
      const inMonitoring = !!iv.step3_completed_at
      if (inMonitoring && iv.decision_date && iv.decision_date <= today) return 0
      if (inMonitoring) return 3
      if (iv.step1_completed_at) return 2
      return 1
    }
    return score(a.cs) - score(b.cs)
  })

  const metricCols: MetricCol[] = metricDefs.map((m) => ({
    id:            m.id,
    name:          m.name,
    is_time_series: !!m.time_dimension,
  }))

  // ── Cases tab data ─────────────────────────────────────────────────
  type CohortLearner = {
    learner_id: string; name: string; email: string
    lf_name: string | null; batch_name: string | null; program_status: string | null
    new_lf: string | null; new_batch: string | null; sub_cohort: string | null
  }
  type SelectedLearnerData = {
    learner_id: string; name: string; email: string
    batch_name: string | null; lf_name: string | null; status: string | null
    new_lf: string | null; new_batch: string | null
  }

  let cohortLearners: CohortLearner[] = []
  let staffUsers: StaffUser[] = []
  let selectedLearnerData: SelectedLearnerData | null = null
  let selectedCase: Case | null = null
  let selectedMetricRows: MetricRow[] = []
  let selectedHistory: ClosedCase[] = []
  let caseRows: CaseRow[] = []
  // Cohort-wide closed cases for the Closed cases sub-tab. Each row carries
  // learner_id + learner_name so the card can label and link the learner.
  let allClosedCases: ClosedCase[] = []
  let caseCategories: string[] = [
    'Life circumstance',
    'Content difficulty',
    'Motivation / confidence',
    'External commitments',
    'Other',
  ]
  let caseChecklistItems: string[] = [
    'Attendance',
    'Assignment completion',
    'Quiz / assessment scores',
    'Coding task progress',
    'Engagement / participation',
  ]

  if (filter === 'cases') {
    const [{ data: allCohort }, { data: staff }, settingsMap] = await Promise.all([
      supabase
        .from('learners')
        .select('learner_id, lf_name, batch_name, status, new_lf, new_batch, sub_cohort, users!learners_user_id_fkey(name, email)')
        .eq('is_current_cohort', true)
        .order('lf_name'),
      supabase.from('users').select('id, name, role').in('role', ['admin', 'staff']).order('name'),
      readSettings(['root_cause_categories', 'case_checklist_items']),
    ])

    cohortLearners = (allCohort ?? []).map((l) => {
      const u = l.users as unknown as { name: string; email: string } | null
      const meta = l as unknown as {
        lf_name: string | null; batch_name: string | null; status: string | null
        new_lf: string | null; new_batch: string | null; sub_cohort: string | null
      }
      return {
        learner_id:     l.learner_id,
        name:           showPII ? (u?.name ?? l.learner_id) : maskName(u?.name, l.learner_id),
        email:          showPII ? (u?.email ?? '') : maskEmail(u?.email),
        lf_name:        meta.lf_name,
        batch_name:     meta.batch_name,
        program_status: meta.status,
        new_lf:         meta.new_lf,
        new_batch:      meta.new_batch,
        sub_cohort:     meta.sub_cohort,
      }
    })
    staffUsers = (staff ?? []) as StaffUser[]
    if (settingsMap['root_cause_categories'])       caseCategories     = settingsMap['root_cause_categories'] as string[]
    if (settingsMap['case_checklist_items']) caseChecklistItems = settingsMap['case_checklist_items'] as string[]

    if (caseView === 'closed') {
      const { data: closedAll } = await supabase
        .from('cases')
        .select('id, learner_id, status, severity, accountable_team, flagged_items, what_wrong_notes, root_cause_type, root_cause_categories, root_cause_notes, interventions, update_log, outcome, outcome_note, decision_date, closed_at, created_at, closed_by_user:users!cases_closer_fkey(name)')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })

      // Batch-fetch triggers for all closed cases so each card can render its
      // anchoring signals without N+1 round-trips.
      const closedIds = (closedAll ?? []).map((r) => r.id)
      type RawClosedTrigger = {
        id:                  string
        case_id:             string
        kind:                'observation' | 'metric'
        metric_period_label: string | null
        metric_value:        number | null
        observation: { id: string; observed_at: string; note: string; type: string | null; severity: string | null } | null
        metric:      { id: string; name: string } | null
      }
      const allTrigsByCase = new Map<string, CaseTrigger[]>()
      if (closedIds.length > 0) {
        const { data: ctAll } = await supabase
          .from('case_triggers')
          .select('id, case_id, kind, metric_period_label, metric_value, observation:learner_observations(id, observed_at, note, type, severity), metric:metrics(id, name)')
          .in('case_id', closedIds)
          .order('created_at', { ascending: true })
        for (const t of ((ctAll ?? []) as unknown as RawClosedTrigger[])) {
          const trig: CaseTrigger = t.kind === 'observation'
            ? { id: t.id, kind: 'observation', observation: t.observation }
            : { id: t.id, kind: 'metric', metric: t.metric, metric_period_label: t.metric_period_label, metric_value: t.metric_value }
          if (!allTrigsByCase.has(t.case_id)) allTrigsByCase.set(t.case_id, [])
          allTrigsByCase.get(t.case_id)!.push(trig)
        }
      }

      const learnerById = new Map(cohortLearners.map((l) => [l.learner_id, l]))
      allClosedCases = (closedAll ?? []).map((iv) => {
        const meta = learnerById.get(iv.learner_id)
        return {
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
          triggers:              allTrigsByCase.get(iv.id) ?? [],
          learner_id:            iv.learner_id,
          learner_name:          meta?.name ?? iv.learner_id,
        }
      })
    }

    if (caseView === 'table') {
      const { data: ivRows } = await supabase
        .from('cases')
        .select('id, learner_id, status, severity, accountable_team, root_cause_type, root_cause_categories, interventions, decision_date, step1_completed_at, step2_completed_at, step3_completed_at')
        .neq('status', 'closed')
        .order('decision_date', { ascending: true, nullsFirst: false })

      const learnerById = new Map(cohortLearners.map((l) => [l.learner_id, l]))
      caseRows = (ivRows ?? []).map((iv) => {
        const items    = (iv.interventions ?? []) as Intervention[]
        const rootCats = ((iv as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? [])
        const rcType   = ((iv as unknown as { root_cause_type?: 'time' | 'learning' | 'both' | 'other' | null }).root_cause_type) ?? null
        const step2Done = !!((iv as unknown as { step2_completed_at?: string | null }).step2_completed_at)
        const meta     = learnerById.get(iv.learner_id)
        return {
          id:                    iv.id,
          learner_id:            iv.learner_id,
          learner_name:          meta?.name ?? iv.learner_id,
          lf_name:               meta?.lf_name ?? null,
          batch_name:            meta?.batch_name ?? null,
          program_status:        meta?.program_status ?? null,
          new_lf:                meta?.new_lf ?? null,
          new_batch:             meta?.new_batch ?? null,
          sub_cohort:            meta?.sub_cohort ?? null,
          status:                iv.status as CaseRow['status'],
          severity:              (iv as unknown as { severity:         CaseRow['severity']         }).severity         ?? null,
          accountable_team:      (iv as unknown as { accountable_team: CaseRow['accountable_team'] }).accountable_team ?? null,
          step1_completed_at:    (iv as unknown as { step1_completed_at: string | null }).step1_completed_at ?? null,
          step3_completed_at:    (iv as unknown as { step3_completed_at: string | null }).step3_completed_at ?? null,
          root_cause_filled:     step2Done,
          root_cause_type:       rcType,
          root_cause_categories: rootCats,
          total_interventions:    items.length,
          done_interventions:     items.filter((it) => !!it.completed_at).length,
          decision_date:         (iv as unknown as { decision_date: string | null }).decision_date ?? null,
          observations:          observationsByLearner.get(iv.learner_id) ?? [],
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
          .from('cases')
          .select('id, learner_id, status, severity, accountable_team, flagged_items, what_wrong_notes, what_wrong_comments, root_cause_type, root_cause_categories, root_cause_notes, why_comments, step1_completed_at, step2_completed_at, step3_completed_at, interventions, decision_date, last_reviewed_at, update_log, created_at, closed_at, outcome, outcome_note')
          .eq('learner_id', selectedLearnerId)
          .neq('status', 'closed')
          .maybeSingle(),
        supabase
          .from('cases')
          .select('id, status, severity, accountable_team, flagged_items, what_wrong_notes, root_cause_type, root_cause_categories, root_cause_notes, interventions, update_log, outcome, outcome_note, decision_date, closed_at, created_at, closed_by_user:users!cases_closer_fkey(name)')
          .eq('learner_id', selectedLearnerId)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false }),
      ])

      // Batch trigger fetch for closed cases of this learner.
      type RawClosedTrigger = {
        id:                  string
        case_id:             string
        kind:                'observation' | 'metric'
        metric_period_label: string | null
        metric_value:        number | null
        observation: { id: string; observed_at: string; note: string; type: string | null; severity: string | null } | null
        metric:      { id: string; name: string } | null
      }
      const closedIds = (closedRaw ?? []).map((r) => r.id)
      const trigsByCase = new Map<string, CaseTrigger[]>()
      if (closedIds.length > 0) {
        const { data: ctRaw } = await supabase
          .from('case_triggers')
          .select('id, case_id, kind, metric_period_label, metric_value, observation:learner_observations(id, observed_at, note, type, severity), metric:metrics(id, name)')
          .in('case_id', closedIds)
          .order('created_at', { ascending: true })
        for (const t of ((ctRaw ?? []) as unknown as RawClosedTrigger[])) {
          const trig: CaseTrigger = t.kind === 'observation'
            ? { id: t.id, kind: 'observation', observation: t.observation }
            : { id: t.id, kind: 'metric', metric: t.metric, metric_period_label: t.metric_period_label, metric_value: t.metric_value }
          if (!trigsByCase.has(t.case_id)) trigsByCase.set(t.case_id, [])
          trigsByCase.get(t.case_id)!.push(trig)
        }
      }

      selectedHistory = (closedRaw ?? []).map((iv) => ({
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
        update_log:            (iv.update_log ?? []) as UpdateLogEntry[],
        outcome:               (iv.outcome ?? null) as ClosedCase['outcome'],
        outcome_note:          iv.outcome_note ?? null,
        decision_date:         (iv as unknown as { decision_date?: string | null }).decision_date ?? null,
        closed_at:             iv.closed_at ?? null,
        closed_by_name:        (iv.closed_by_user as unknown as { name: string } | null)?.name ?? null,
        opened_at:             iv.created_at ?? null,
        triggers:              trigsByCase.get(iv.id) ?? [],
      }))

      if (sl) {
        const u = sl.users as unknown as { name: string; email: string } | null
        const slEmail = u?.email?.trim().toLowerCase() ?? ''
        selectedLearnerData = {
          learner_id: sl.learner_id,
          name:       showPII ? (u?.name ?? sl.learner_id) : maskName(u?.name, sl.learner_id),
          email:      showPII ? slEmail : maskEmail(slEmail),
          batch_name: sl.batch_name ?? null,
          lf_name:    sl.lf_name ?? null,
          status:     (sl as unknown as { status: string }).status ?? null,
          new_lf:     (sl as unknown as { new_lf: string | null }).new_lf ?? null,
          new_batch:  (sl as unknown as { new_batch: string | null }).new_batch ?? null,
        }

        // Compute metric values for this learner (same pattern as deep-dive page)
        if (slEmail && metricDefs.length > 0) {
          const sourceIds = [...new Set(metricDefs.map((m) => m.source_id).filter((s): s is string => !!s))]
          const { data: rawRowsData } = sourceIds.length > 0
            ? await supabase
                .from('metric_raw_rows')
                .select('source_id, learner_id, dimensions, value')
                .eq('learner_id', slEmail)
                .limit(10000)
            : { data: [] }

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
          const computed = computeAllForLearner(topoSortMetrics(metricDefs), bySource)
          selectedMetricRows = metricDefs.map((m) => ({ id: m.id, name: m.name, computed: computed[m.id] }))
        }
      }

      if (iv) {
        // Triggers fetch for this active case — joined with observation + metric metadata.
        type RawTrigger = {
          id:                  string
          kind:                'observation' | 'metric'
          metric_period_label: string | null
          metric_value:        number | null
          observation: { id: string; observed_at: string; note: string; type: string | null; severity: string | null } | null
          metric:      { id: string; name: string } | null
        }
        const { data: trigRaw } = await supabase
          .from('case_triggers')
          .select('id, kind, metric_period_label, metric_value, observation:learner_observations(id, observed_at, note, type, severity), metric:metrics(id, name)')
          .eq('case_id', iv.id)
          .order('created_at', { ascending: true })
        const triggers: CaseTrigger[] = ((trigRaw ?? []) as unknown as RawTrigger[]).map((t): CaseTrigger =>
          t.kind === 'observation'
            ? { id: t.id, kind: 'observation', observation: t.observation }
            : { id: t.id, kind: 'metric', metric: t.metric, metric_period_label: t.metric_period_label, metric_value: t.metric_value }
        )

        selectedCase = {
          id:                    iv.id,
          learner_id:            iv.learner_id,
          status:                iv.status as Case['status'],
          severity:              (iv as unknown as { severity:         Case['severity']         }).severity         ?? null,
          accountable_team:      (iv as unknown as { accountable_team: Case['accountable_team'] }).accountable_team ?? null,
          flagged_items:         ((iv as unknown as { flagged_items?: string[] }).flagged_items ?? []),
          what_wrong_notes:      (iv as unknown as { what_wrong_notes?: string | null }).what_wrong_notes ?? null,
          what_wrong_comments:   ((iv as unknown as { what_wrong_comments?: unknown[] }).what_wrong_comments ?? []) as Case['what_wrong_comments'],
          root_cause_type:       ((iv as unknown as { root_cause_type?: 'time' | 'learning' | 'both' | 'other' | null }).root_cause_type) ?? null,
          root_cause_categories: ((iv as unknown as { root_cause_categories?: string[] }).root_cause_categories ?? []),
          root_cause_notes:      iv.root_cause_notes ?? null,
          why_comments:          ((iv as unknown as { why_comments?: unknown[] }).why_comments ?? []) as Case['why_comments'],
          step1_completed_at:    iv.step1_completed_at ?? null,
          step2_completed_at:    iv.step2_completed_at ?? null,
          step3_completed_at:    (iv as unknown as { step3_completed_at?: string | null }).step3_completed_at ?? null,
          interventions:         (iv.interventions ?? []) as Case['interventions'],
          decision_date:         (iv as unknown as { decision_date: string | null }).decision_date ?? null,
          last_reviewed_at:      iv.last_reviewed_at ?? null,
          update_log:            ((iv as unknown as { update_log?: unknown[] }).update_log ?? []) as Case['update_log'],
          created_at:            (iv as unknown as { created_at?: string | null }).created_at ?? null,
          closed_at:             (iv as unknown as { closed_at?:  string | null }).closed_at  ?? null,
          outcome:               (iv as unknown as { outcome?:    Case['outcome']            }).outcome    ?? null,
          outcome_note:          (iv as unknown as { outcome_note?: string | null            }).outcome_note ?? null,
          triggers,
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
      <LearningTabs
        activeKey={filter}
        tabs={[
          { key: 'all',           label: 'Dashboard',     href: `/learning?filter=all${lf ? `&lf=${lf}` : ''}` },
          { key: 'cases', label: 'Cases', href: `/learning?filter=cases${lf ? `&lf=${lf}` : ''}` },
          { key: 'attendance',    label: 'Attendance',    href: '/learning/attendance' },
          { key: 'deep-dive',     label: 'Deep Dive',     href: '/learning/deep-dive' },
          ...(appUser.role !== 'learner' ? [{ key: 'settings', label: 'Settings', href: '/learning/settings' }] : []),
        ]}
      />

      {filter === 'all' && (
        <LearningDashboard
          learners={learnerRows}
          metrics={metricCols}
          subCohortOptions={subCohortOptions}
          currentUserId={appUser.id}
          currentUserName={appUser.name ?? null}
          isAdmin={appUser.role === 'admin'}
          canEdit={appUser.role === 'admin' || appUser.role === 'staff'}
          observationCategories={observationCategories}
        />
      )}

      {filter === 'cases' && (
        <div className="space-y-6 pb-32">
          {/* Sub-tabs: Table view | Learner-wise | Closed cases */}
          <div className="flex items-center gap-1 border-b border-zinc-200">
            {[
              { key: 'table',   label: 'Table view'    },
              { key: 'learner', label: 'Learner-wise'  },
              { key: 'closed',  label: 'Closed cases'  },
            ].map(({ key, label }) => (
              <Link
                key={key}
                href={`/learning?filter=cases&view=${key}`}
                className={`relative pb-2.5 px-1 mr-4 text-sm font-medium transition-colors ${
                  caseView === key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
                {caseView === key && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
              </Link>
            ))}
          </div>

          {caseView === 'learner' && (
            <>
              {/* Learner search */}
              <LearnerSearchBox learners={cohortLearners} selectedId={selectedLearnerId ?? null} />

              {/* Selected learner view */}
              {selectedLearnerData && (
                <div className="space-y-6">
                  <CasePanel
                    key={`${selectedLearnerData.learner_id}:${selectedCase?.id ?? 'none'}`}
                    learnerId={selectedLearnerData.learner_id}
                    cs={selectedCase}
                    learner={{
                      name:           selectedLearnerData.name,
                      batch_name:     selectedLearnerData.batch_name,
                      new_batch:      selectedLearnerData.new_batch,
                      lf_name:        selectedLearnerData.lf_name,
                      new_lf:         selectedLearnerData.new_lf,
                      program_status: selectedLearnerData.status,
                    }}
                    staffUsers={staffUsers}
                    categories={caseCategories}
                    checklistItems={caseChecklistItems}
                    currentUserId={appUser.id}
                    currentUserName={appUser.name ?? null}
                    observationsForLearner={observationsByLearner.get(selectedLearnerData.learner_id) ?? []}
                    metricOptions={metricDefs.map((m) => ({ id: m.id, name: m.name }))}
                  />

                  {selectedHistory.length > 0 && (
                    <CaseHistory history={selectedHistory} fallbackLearnerId={selectedLearnerData.learner_id} />
                  )}
                </div>
              )}

              {!selectedLearnerId && (
                <p className="text-sm text-zinc-400">Select a learner to view or start a case.</p>
              )}
            </>
          )}

          {caseView === 'table' && (
            <CasesTable
              rows={caseRows}
              learners={cohortLearners}
              subCohortOptions={subCohortOptions}
              currentUserId={appUser.id}
              currentUserName={appUser.name ?? null}
              isAdmin={appUser.role === 'admin'}
              observationCategories={observationCategories}
              observationsByLearner={Object.fromEntries(observationsByLearner)}
              metricOptions={metricDefs.map((m) => ({ id: m.id, name: m.name }))}
            />
          )}

          {caseView === 'closed' && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Closed cases ({allClosedCases.length})
              </p>
              <ClosedCasesTable rows={allClosedCases} />
            </div>
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
            <Link href={`/learning/deep-dive?learner=${learner.learner_id}`} className="text-base font-bold text-zinc-900 hover:underline">{learner.name}</Link>
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
