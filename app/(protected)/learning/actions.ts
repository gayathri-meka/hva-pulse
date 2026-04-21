'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, requireStaff } from '@/lib/auth'
import { getSheetRaw, getSheetRows } from '@/lib/google'
import { runBigQuery } from '@/lib/bigquery'

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') throw new Error('Admin only')
  return user
}

// ── Metric actions ────────────────────────────────────────────────────────────

export type CompositeInput = {
  metric_id:      string
  weight:         number
  summary_method: 'last' | 'avg' | 'sum' | null
}

export type CreateMetricInput =
  | {
      kind: 'simple'
      name: string
      sourceId: string
      aggregation: string
      filters: { column: string; operator: string; value: string }[]
      timeDimension: string | null
      timeSortOrder: string | null
      fillGaps: boolean
      filterLogic: 'and' | 'or'
      description: string
    }
  | {
      kind: 'composite'
      name: string
      description: string
      compositeInputs: CompositeInput[]
    }

export async function createMetricDef(data: CreateMetricInput) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  if (data.kind === 'simple') {
    const { error } = await supabase.from('metrics').insert({
      kind:            'simple',
      name:            data.name,
      source_id:       data.sourceId,
      aggregation:     data.aggregation,
      filters:         data.filters,
      time_dimension:  data.timeDimension,
      time_sort_order: data.timeSortOrder,
      fill_gaps:       data.fillGaps ?? true,
      filter_logic:    data.filterLogic ?? 'and',
      description:     data.description,
    })
    if (error) throw new Error(error.message)
  } else {
    if (!data.compositeInputs?.length) throw new Error('Composite metric needs at least one input')
    await assertNoCycles(supabase, null, data.compositeInputs)
    const { error } = await supabase.from('metrics').insert({
      kind:             'composite',
      name:             data.name,
      description:      data.description,
      composite_inputs: data.compositeInputs,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/learning/settings')
  revalidatePath('/learning')
}

/** Walk the dependency graph; throw if adding `inputs` to metric `selfId` (null for new) would create a cycle. */
async function assertNoCycles(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  selfId: string | null,
  inputs: CompositeInput[],
) {
  const { data: all } = await supabase.from('metrics').select('id, kind, composite_inputs')
  const byId = new Map<string, { kind: string; composite_inputs: CompositeInput[] }>()
  for (const m of all ?? []) {
    byId.set(m.id, { kind: m.kind, composite_inputs: (m.composite_inputs ?? []) as CompositeInput[] })
  }

  // Simulated self-row (or override if editing)
  if (selfId) byId.set(selfId, { kind: 'composite', composite_inputs: inputs })

  function visit(id: string, stack: Set<string>): void {
    if (stack.has(id)) throw new Error('Composite metric cycle detected — a metric cannot depend on itself transitively')
    const node = byId.get(id)
    if (!node || node.kind !== 'composite') return
    stack.add(id)
    for (const inp of node.composite_inputs) visit(inp.metric_id, stack)
    stack.delete(id)
  }

  // Walk from this metric's inputs (or itself if editing)
  if (selfId) visit(selfId, new Set())
  else for (const inp of inputs) visit(inp.metric_id, new Set([':new:']))
}

export async function updateMetricDef(id: string, data: CreateMetricInput) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  if (data.kind === 'simple') {
    const { error } = await supabase
      .from('metrics')
      .update({
        kind:            'simple',
        name:            data.name,
        source_id:       data.sourceId,
        aggregation:     data.aggregation,
        filters:         data.filters,
        time_dimension:  data.timeDimension,
        time_sort_order: data.timeSortOrder,
        fill_gaps:       data.fillGaps ?? true,
        filter_logic:    data.filterLogic ?? 'and',
        description:     data.description,
        composite_inputs: [],
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    if (!data.compositeInputs?.length) throw new Error('Composite metric needs at least one input')
    await assertNoCycles(supabase, id, data.compositeInputs)
    const { error } = await supabase
      .from('metrics')
      .update({
        kind:             'composite',
        name:             data.name,
        description:      data.description,
        composite_inputs: data.compositeInputs,
        source_id:        null,
        aggregation:      null,
        filters:          [],
        time_dimension:   null,
        time_sort_order:  null,
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/learning/settings')
  revalidatePath('/learning')
}

export async function deleteMetricDef(id: string) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('metrics').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning/settings')
}

/** Returns sorted distinct values for a dimension column from the raw rows of a source. */
export async function getDistinctDimensionValues(sourceId: string, columnName: string): Promise<string[]> {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('metric_raw_rows')
    .select('dimensions')
    .eq('source_id', sourceId)
  if (!data) return []
  const seen = new Set<string>()
  for (const row of data) {
    const val = (row.dimensions as Record<string, unknown>)?.[columnName]
    if (val != null && String(val).trim()) seen.add(String(val).trim())
  }
  return Array.from(seen).sort()
}

// ── Data source actions ───────────────────────────────────────────────────────

function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : urlOrId.trim()
}

function normalizeHeader(h: string): string {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_')
}

/** Reads the sheet header row and returns normalized column names + the extracted sheet ID. */
export async function previewSheetSource(urlOrId: string, tabName: string) {
  await requireAdmin()
  const sheetId = extractSheetId(urlOrId)
  const { headers } = await getSheetRaw(sheetId, tabName, 0)
  const columns = headers.map(normalizeHeader).filter(Boolean)
  if (columns.length === 0) throw new Error('No columns found — check the tab name and make sure row 1 is the header.')
  return { sheetId, columns }
}

/** Preview a BigQuery table/view — returns column names for role mapping. */
export async function previewBqSource(bqProject: string, bqDataset: string, bqTable: string) {
  await requireAdmin()
  const fqTable = `${bqDataset}.${bqTable}`
  const rows = await runBigQuery(bqProject, `SELECT * FROM \`${fqTable}\` LIMIT 1`)
  if (rows.length === 0) throw new Error('View returned 0 rows — is it empty or does the name have a typo?')
  const columns = Object.keys(rows[0])
  if (columns.length === 0) throw new Error('No columns found')
  return { columns }
}

export async function createBqDataSource(data: {
  name: string
  bqProject: string
  bqDataset: string
  bqTable: string
  bqFilter: string
  columns: { column_name: string; role: string; label: string | null }[]
}) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  const { data: source, error } = await supabase
    .from('metric_sources')
    .insert({
      name:        data.name,
      source_type: 'bigquery',
      bq_project:  data.bqProject,
      bq_dataset:  data.bqDataset,
      bq_table:    data.bqTable,
      bq_filter:   data.bqFilter || null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { error: colErr } = await supabase.from('metric_source_columns').insert(
    data.columns.map((c) => ({
      source_id:   source.id,
      column_name: c.column_name,
      role:        c.role,
      label:       c.label || null,
    }))
  )
  if (colErr) throw new Error(colErr.message)

  revalidatePath('/learning/settings')
}

/** Update an existing data source's connection details (not column mappings). */
export async function updateDataSourceDetails(id: string, data: {
  name: string
  // Sheet fields
  sheetId?: string
  sheetTab?: string
  // BQ fields
  bqProject?: string
  bqDataset?: string
  bqTable?: string
  bqFilter?: string
}) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('metric_sources')
    .update({
      name:       data.name,
      sheet_id:   data.sheetId ?? null,
      sheet_tab:  data.sheetTab ?? null,
      bq_project: data.bqProject ?? null,
      bq_dataset: data.bqDataset ?? null,
      bq_table:   data.bqTable ?? null,
      bq_filter:  data.bqFilter ?? null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning/settings')
}

export async function createDataSource(data: {
  name: string
  sheetId: string
  sheetTab: string
  columns: { column_name: string; role: string; label: string | null }[]
}) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  const { data: source, error } = await supabase
    .from('metric_sources')
    .insert({ name: data.name, sheet_id: data.sheetId, sheet_tab: data.sheetTab })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { error: colErr } = await supabase.from('metric_source_columns').insert(
    data.columns.map((c) => ({
      source_id:   source.id,
      column_name: c.column_name,
      role:        c.role,
      label:       c.label || null,
    }))
  )
  if (colErr) throw new Error(colErr.message)

  revalidatePath('/learning/settings')
}

// ── Intervention actions ──────────────────────────────────────────────────────

export async function startIntervention(learnerId: string) {
  const user = await requireStaff()
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('interventions')
    .select('id')
    .eq('learner_id', learnerId)
    .neq('status', 'closed')
    .maybeSingle()
  if (existing) throw new Error('Learner already has an active intervention')

  const now           = new Date()
  const decisionDate  = new Date(now)
  decisionDate.setDate(decisionDate.getDate() + 14)

  const { data, error } = await supabase
    .from('interventions')
    .insert({
      learner_id:    learnerId,
      opened_by:     user.id,
      decision_date: decisionDate.toISOString().slice(0, 10),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${learnerId}`)
  return data.id
}

// Step 1: "What's wrong?" — checklist items + free text
export async function saveInterventionStep1(
  id: string,
  data: { flagged_items: string[]; what_wrong_notes: string },
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      flagged_items:      data.flagged_items,
      what_wrong_notes:   data.what_wrong_notes || null,
      status:             'in_progress',
      step1_completed_at: new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

// Step 2: "Why?" — root cause categories (multi-select) + notes
export async function saveInterventionStep2(
  id: string,
  data: { root_cause_categories: string[]; root_cause_notes: string },
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      root_cause_categories: data.root_cause_categories,
      root_cause_notes:      data.root_cause_notes || null,
      step2_completed_at:    new Date().toISOString(),
      updated_at:            new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

// Step 3: "What next?" — action items (initial save, transitions to follow_up)
export async function saveInterventionStep3(
  id: string,
  actionItems: { description: string; owner: string; due_date: string | null }[],
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const now      = new Date()

  const { error } = await supabase
    .from('interventions')
    .update({
      action_items:       actionItems,
      status:             'follow_up',
      step3_completed_at: now.toISOString(),
      updated_at:         now.toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

export async function saveActionItems(
  id: string,
  actionItems: { description: string; owner: string; due_date: string | null; completed_at: string | null }[],
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({ action_items: actionItems, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

export async function clearInterventionStep1(id: string) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { data: existing } = await supabase
    .from('interventions')
    .select('step2_completed_at, learner_id')
    .eq('id', id)
    .single()
  if (!existing) throw new Error('Intervention not found')
  const updates: Record<string, unknown> = {
    flagged_items:      [],
    what_wrong_notes:   null,
    step1_completed_at: null,
    updated_at:         new Date().toISOString(),
  }
  if (!existing.step2_completed_at) updates.status = 'open'

  const { error } = await supabase.from('interventions').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${existing.learner_id}`)
}

export async function deleteIntervention(id: string) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { data: existing } = await supabase
    .from('interventions')
    .select('learner_id')
    .eq('id', id)
    .single()
  const { error } = await supabase.from('interventions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  if (existing?.learner_id) revalidatePath(`/learning/${existing.learner_id}`)
}

/** Update decision date directly (no update-log side-effects). */
export async function updateDecisionDate(id: string, newDate: string) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) throw new Error('Invalid date')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      decision_date: newDate,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

/** Append an update-log entry. Optionally push the decision date. */
export async function saveUpdate(id: string, note: string, newDecisionDate: string | null) {
  if (!note.trim()) throw new Error('Note is required')
  if (newDecisionDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDecisionDate)) throw new Error('Invalid date')
  const user = await requireStaff()
  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('interventions')
    .select('update_log, learner_id')
    .eq('id', id)
    .single()
  if (!existing) throw new Error('Intervention not found')

  const newEntry = {
    at:                      new Date().toISOString(),
    by:                      user.id,
    by_name:                 user.name ?? null,
    note:                    note.trim(),
    decision_date_pushed_to: newDecisionDate ?? null,
  }

  const updates: Record<string, unknown> = {
    update_log:       [...((existing.update_log ?? []) as unknown[]), newEntry],
    last_reviewed_at: new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }
  if (newDecisionDate) updates.decision_date = newDecisionDate

  const { error } = await supabase.from('interventions').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${existing.learner_id}`)
}

export async function closeIntervention(
  id: string,
  learnerId: string,
  outcome: 'resolved' | 'dropped' | 'other',
  outcomeNote: string,
) {
  if (!outcomeNote.trim()) throw new Error('Outcome note is required')
  const user = await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      status:       'closed',
      outcome,
      outcome_note: outcomeNote.trim(),
      closed_at:    new Date().toISOString(),
      closed_by:    user.id,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${learnerId}`)
}

// ── Data source actions ───────────────────────────────────────────────────────

/** Update column role mappings for an existing data source. */
export async function updateDataSourceColumns(
  sourceId: string,
  columns: { column_name: string; role: string; label: string | null }[],
) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  // Delete existing mappings and replace
  const { error: delErr } = await supabase.from('metric_source_columns').delete().eq('source_id', sourceId)
  if (delErr) throw new Error(delErr.message)
  const { error: insErr } = await supabase.from('metric_source_columns').insert(
    columns.map((c) => ({
      source_id:   sourceId,
      column_name: c.column_name,
      role:        c.role,
      label:       c.label || null,
    }))
  )
  if (insErr) throw new Error(insErr.message)
  revalidatePath('/learning/settings')
}

export async function deleteDataSource(id: string) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('metric_sources').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning/settings')
}

export async function syncDataSource(id: string) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  const [{ data: source }, { data: columns }] = await Promise.all([
    supabase.from('metric_sources').select('*').eq('id', id).single(),
    supabase.from('metric_source_columns').select('*').eq('source_id', id),
  ])
  if (!source) throw new Error('Source not found')

  const learnerIdCol  = columns?.find((c) => c.role === 'learner_id')
  const valueCol      = columns?.find((c) => c.role === 'value')
  const dimensionCols = columns?.filter((c) => c.role === 'dimension') ?? []

  if (!learnerIdCol) throw new Error('No learner_id column mapped')

  const sourceType = (source as unknown as { source_type?: string }).source_type ?? 'sheet'

  try {
    // ── Fetch rows from the appropriate source ────────────────────────────────
    let rawRows: Record<string, string | null>[]

    if (sourceType === 'bigquery') {
      const { bq_project, bq_dataset, bq_table, bq_filter } = source as unknown as {
        bq_project: string; bq_dataset: string; bq_table: string; bq_filter: string | null
      }
      if (!bq_project || !bq_dataset || !bq_table) {
        throw new Error('BigQuery source missing project/dataset/table')
      }
      const fqTable = `${bq_dataset}.${bq_table}`
      const where = bq_filter?.trim() ? ` WHERE ${bq_filter.trim()}` : ''
      rawRows = await runBigQuery(bq_project, `SELECT * FROM \`${fqTable}\`${where}`)
    } else {
      rawRows = await getSheetRows(source.sheet_id, source.sheet_tab)
    }

    // ── Full replace — delete all existing rows for this source then bulk insert
    await supabase.from('metric_raw_rows').delete().eq('source_id', id)

    const newRows = rawRows
      .filter((r) => r[learnerIdCol.column_name]?.trim())
      .map((r) => ({
        source_id:  id,
        learner_id: (r[learnerIdCol.column_name] ?? '').trim().toLowerCase(),
        value:      valueCol ? (r[valueCol.column_name] || null) : null,
        dimensions: Object.fromEntries(
          dimensionCols.map((c) => [c.column_name, r[c.column_name] || null])
        ),
      }))

    // Insert in batches (BQ views can return 250k+ rows; Supabase chokes on
    // single inserts of that size)
    const BATCH = 5000
    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH)
      const { error: insertErr } = await supabase.from('metric_raw_rows').insert(batch)
      if (insertErr) throw new Error(insertErr.message)
    }

    await supabase
      .from('metric_sources')
      .update({ last_synced_at: new Date().toISOString(), row_count: newRows.length, sync_error: null })
      .eq('id', id)
  } catch (e) {
    await supabase
      .from('metric_sources')
      .update({ sync_error: String(e) })
      .eq('id', id)
    throw e
  }

  revalidatePath('/learning/settings')
}
