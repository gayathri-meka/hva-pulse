'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, requireStaff } from '@/lib/auth'
import { getSheetRaw, getSheetRows } from '@/lib/google'

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') throw new Error('Admin only')
  return user
}

// ── Metric actions ────────────────────────────────────────────────────────────

export async function createMetricDef(data: {
  name: string
  sourceId: string
  aggregation: string
  filters: { column: string; operator: string; value: string }[]
  timeDimension: string | null
  timeSortOrder: string | null
  description: string
}) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('metrics').insert({
    name:            data.name,
    source_id:       data.sourceId,
    aggregation:     data.aggregation,
    filters:         data.filters,
    time_dimension:  data.timeDimension,
    time_sort_order: data.timeSortOrder,
    description:     data.description,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/learning/settings')
}

export async function updateMetricDef(id: string, data: {
  name: string
  sourceId: string
  aggregation: string
  filters: { column: string; operator: string; value: string }[]
  timeDimension: string | null
  timeSortOrder: string | null
  description: string
}) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('metrics')
    .update({
      name:            data.name,
      source_id:       data.sourceId,
      aggregation:     data.aggregation,
      filters:         data.filters,
      time_dimension:  data.timeDimension,
      time_sort_order: data.timeSortOrder,
      description:     data.description,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
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

  const { data, error } = await supabase
    .from('interventions')
    .insert({ learner_id: learnerId, opened_by: user.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${learnerId}`)
  return data.id
}

export async function saveInterventionStep1(
  id: string,
  data: { root_cause_category: string; root_cause_notes: string },
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      ...data,
      status:            'in_progress',
      step1_completed_at: new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

export async function saveInterventionStep2(
  id: string,
  actionItems: { description: string; owner: string; due_date: string | null }[],
) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()
  const now      = new Date()
  const resurface = new Date(now)
  resurface.setDate(resurface.getDate() + 14)

  const { error } = await supabase
    .from('interventions')
    .update({
      action_items:       actionItems,
      status:             'monitoring',
      step2_completed_at: now.toISOString(),
      resurface_date:     resurface.toISOString().slice(0, 10),
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

export async function extendIntervention(id: string) {
  await requireStaff()
  const supabase = await createServerSupabaseClient()

  const { data: intervention } = await supabase
    .from('interventions')
    .select('resurface_date')
    .eq('id', id)
    .single()
  if (!intervention) throw new Error('Intervention not found')

  const base = intervention.resurface_date ? new Date(intervention.resurface_date) : new Date()
  base.setDate(base.getDate() + 14)

  const { error } = await supabase
    .from('interventions')
    .update({
      resurface_date:   base.toISOString().slice(0, 10),
      last_reviewed_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
}

export async function closeIntervention(
  id: string,
  learnerId: string,
  outcome: 'resolved' | 'dropped' | 'other',
  outcomeNote: string,
) {
  const user = await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('interventions')
    .update({
      status:      'closed',
      outcome,
      outcome_note: outcomeNote || null,
      closed_at:   new Date().toISOString(),
      closed_by:   user.id,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/learning')
  revalidatePath(`/learning/${learnerId}`)
}

// ── Data source actions ───────────────────────────────────────────────────────

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

  try {
    const rows = await getSheetRows(source.sheet_id, source.sheet_tab)

    // Full replace — delete all existing rows for this source then bulk insert
    await supabase.from('metric_raw_rows').delete().eq('source_id', id)

    const newRows = rows
      .filter((r) => r[learnerIdCol.column_name]?.trim())
      .map((r) => ({
        source_id:  id,
        learner_id: r[learnerIdCol.column_name].trim().toLowerCase(),
        value:      valueCol ? (r[valueCol.column_name] || null) : null,
        dimensions: Object.fromEntries(
          dimensionCols.map((c) => [c.column_name, r[c.column_name] || null])
        ),
      }))

    if (newRows.length > 0) {
      const { error: insertErr } = await supabase.from('metric_raw_rows').insert(newRows)
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
