'use client'

import { useState, useTransition } from 'react'
import {
  previewSheetSource,
  createDataSource,
  previewBqSource,
  createBqDataSource,
  deleteDataSource,
  syncDataSource,
  updateDataSourceDetails,
} from '@/app/(protected)/learning/actions'

export type DataSource = {
  id: string
  name: string
  source_type: 'sheet' | 'bigquery'
  sheet_id: string | null
  sheet_tab: string | null
  bq_project: string | null
  bq_dataset: string | null
  bq_table: string | null
  bq_filter: string | null
  last_synced_at: string | null
  row_count: number | null
  sync_error: string | null
}

type ColumnMapping = {
  column_name: string
  role: 'learner_id' | 'value' | 'dimension' | 'ignored'
  label: string
}

interface Props {
  sources: DataSource[]
}

export default function DataSourcesPanel({ sources }: Props) {
  const [connectType, setConnectType] = useState<'sheet' | 'bigquery' | null>(null)

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Connected Sources
        </span>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-zinc-400">No data sources connected yet.</p>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setConnectType('sheet')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span className="text-base leading-none">+</span>
          Connect a sheet
        </button>
        <button
          onClick={() => setConnectType('bigquery')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span className="text-base leading-none">+</span>
          Connect BigQuery view
        </button>
      </div>

      {connectType === 'sheet' && <ConnectModal onClose={() => setConnectType(null)} />}
      {connectType === 'bigquery' && <ConnectBqModal onClose={() => setConnectType(null)} />}
    </div>
  )
}

// ── Source card ────────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: DataSource }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  function handleSync() {
    setError('')
    startTransition(async () => {
      try {
        await syncDataSource(source.id)
      } catch (e) {
        setError(String(e))
      }
    })
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete "${source.name}"? All synced rows and any metrics built on this source will also be deleted.`
      )
    )
      return
    startTransition(async () => {
      await deleteDataSource(source.id)
    })
  }

  const syncTime = source.last_synced_at
    ? `Synced ${formatRelative(source.last_synced_at)}`
    : 'Never synced'

  const syncDotColor = source.sync_error
    ? 'bg-[#E24B4A]'
    : source.last_synced_at
    ? 'bg-[#5BAE5B]'
    : 'bg-amber-400'

  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        source.sync_error ? 'border-red-200 bg-red-50/40' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Icon tile */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E1F5EE]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4 text-[#085041]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m-18 0h18" />
          </svg>
        </div>

        {/* Name + sync status */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-900">{source.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${syncDotColor}`} />
            {source.sync_error ? (
              <span className="text-[#E24B4A]">{source.sync_error}</span>
            ) : (
              <span>{syncTime}</span>
            )}
          </div>
        </div>

        {/* Row count */}
        {source.row_count != null && (
          <div className="shrink-0 text-right">
            <div className="text-sm font-medium text-zinc-700">{source.row_count.toLocaleString()}</div>
            <div className="text-xs text-zinc-400">rows</div>
          </div>
        )}

        {/* Source detail */}
        <div className="w-44 shrink-0">
          {source.source_type === 'bigquery' ? (
            <>
              <div className="text-xs text-zinc-400">View:</div>
              <div className="truncate text-xs text-zinc-600">{source.bq_table}</div>
            </>
          ) : (
            <>
              <div className="text-xs text-zinc-400">Tab:</div>
              <div className="truncate text-xs text-zinc-600">{source.sheet_tab}</div>
            </>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={handleSync}
          disabled={isPending}
          className="shrink-0 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          {isPending ? 'Syncing…' : 'Sync now'}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {editing && <EditSourceModal source={source} onClose={() => setEditing(false)} />}
    </div>
  )
}

// ── Connect modal ──────────────────────────────────────────────────────────────

function ConnectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'mapping'>('form')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [url, setUrl]   = useState('')
  const [tab, setTab]   = useState('')

  // Step 2
  const [sheetId, setSheetId]   = useState('')
  const [columns, setColumns]   = useState<ColumnMapping[]>([])

  function handlePreview() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!url.trim())  { setError('Sheet URL is required'); return }
    if (!tab.trim())  { setError('Tab name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        const result = await previewSheetSource(url.trim(), tab.trim())
        setSheetId(result.sheetId)
        setColumns(
          result.columns.map((col) => ({ column_name: col, role: 'ignored', label: '' }))
        )
        setStep('mapping')
      } catch (e) {
        setError(String(e))
      }
    })
  }

  function setRole(colName: string, role: ColumnMapping['role']) {
    setColumns((prev) => {
      let next = prev.map((c) => (c.column_name === colName ? { ...c, role } : c))
      // Enforce single learner_id and single value
      if (role === 'learner_id')
        next = next.map((c) => c.column_name !== colName && c.role === 'learner_id' ? { ...c, role: 'ignored' } : c)
      if (role === 'value')
        next = next.map((c) => c.column_name !== colName && c.role === 'value' ? { ...c, role: 'ignored' } : c)
      return next
    })
  }

  function setDimensionLabel(colName: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.column_name === colName ? { ...c, label } : c)))
  }

  function handleSave() {
    if (!columns.some((c) => c.role === 'learner_id')) {
      setError('Mark one column as Learner ID'); return
    }
    const unlabelled = columns.find((c) => c.role === 'dimension' && !c.label.trim())
    if (unlabelled) {
      setError(`Add a label for dimension column "${unlabelled.column_name}"`); return
    }
    setError('')
    startTransition(async () => {
      try {
        await createDataSource({
          name:     name.trim(),
          sheetId,
          sheetTab: tab.trim(),
          columns:  columns.map((c) => ({
            column_name: c.column_name,
            role:        c.role,
            label:       c.role === 'dimension' ? c.label.trim() : null,
          })),
        })
        onClose()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">

        {step === 'form' && (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900">Connect a Google Sheet</h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              The sheet must be in long format — one row per data point. You&apos;ll assign each
              column a role on the next step: one column is the learner email, one is the value
              being measured, and any others you want to filter on become dimensions.
            </p>

            <div className="space-y-3">
              <Field label="Source name">
                <input
                  autoFocus
                  className={inputCls}
                  placeholder="e.g. Attendance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Sheet URL">
                <input
                  className={inputCls}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
              <Field label="Tab name">
                <input
                  className={inputCls}
                  placeholder="e.g. Sheet1"
                  value={tab}
                  onChange={(e) => setTab(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                />
              </Field>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={onClose} className={cancelBtn}>Cancel</button>
              <button onClick={handlePreview} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Reading sheet…' : 'Preview columns →'}
              </button>
            </div>
          </>
        )}

        {step === 'mapping' && (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900">Map columns</h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Assign a role to each column. Dimension columns need a friendly label — that&apos;s
              what you&apos;ll see when building metric filters.
            </p>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {columns.map((col) => (
                <div key={col.column_name} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate font-mono text-xs text-zinc-700">
                      {col.column_name}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRole(col.column_name, r)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            col.role === r ? ROLE_ACTIVE[r] : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          }`}
                        >
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {col.role === 'dimension' && (
                    <input
                      className={`mt-2 ${inputCls}`}
                      placeholder="Friendly label, e.g. Session type"
                      value={col.label}
                      onChange={(e) => setDimensionLabel(col.column_name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setStep('form'); setError('') }} className={cancelBtn}>
                ← Back
              </button>
              <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Saving…' : 'Save source'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── BigQuery connect modal ────────────────────────────────────────────────────

function ConnectBqModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'mapping'>('form')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name,      setName]      = useState('')
  const [bqProject, setBqProject] = useState('hyperverge-chabtbot')
  const [bqDataset, setBqDataset] = useState('sensai-441917.sensai_prod')
  const [bqTable,   setBqTable]   = useState('')
  const [bqFilter,  setBqFilter]  = useState('')
  const [columns,   setColumns]   = useState<ColumnMapping[]>([])

  function handlePreview() {
    if (!name.trim())      { setError('Name is required'); return }
    if (!bqProject.trim()) { setError('Billing project is required'); return }
    if (!bqDataset.trim()) { setError('Dataset is required'); return }
    if (!bqTable.trim())   { setError('View name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        const result = await previewBqSource(bqProject.trim(), bqDataset.trim(), bqTable.trim())
        setColumns(result.columns.map((col) => ({ column_name: col, role: 'ignored', label: '' })))
        setStep('mapping')
      } catch (e) {
        setError(String(e))
      }
    })
  }

  function setRole(colName: string, role: ColumnMapping['role']) {
    setColumns((prev) => {
      let next = prev.map((c) => (c.column_name === colName ? { ...c, role } : c))
      if (role === 'learner_id')
        next = next.map((c) => c.column_name !== colName && c.role === 'learner_id' ? { ...c, role: 'ignored' } : c)
      if (role === 'value')
        next = next.map((c) => c.column_name !== colName && c.role === 'value' ? { ...c, role: 'ignored' } : c)
      return next
    })
  }

  function setDimensionLabel(colName: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.column_name === colName ? { ...c, label } : c)))
  }

  function handleSave() {
    if (!columns.some((c) => c.role === 'learner_id')) {
      setError('Mark one column as Learner ID'); return
    }
    const unlabelled = columns.find((c) => c.role === 'dimension' && !c.label.trim())
    if (unlabelled) {
      setError(`Add a label for dimension column "${unlabelled.column_name}"`); return
    }
    setError('')
    startTransition(async () => {
      try {
        await createBqDataSource({
          name:      name.trim(),
          bqProject: bqProject.trim(),
          bqDataset: bqDataset.trim(),
          bqTable:   bqTable.trim(),
          bqFilter:  bqFilter.trim(),
          columns:   columns.map((c) => ({
            column_name: c.column_name,
            role:        c.role,
            label:       c.role === 'dimension' ? c.label.trim() : null,
          })),
        })
        onClose()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
        {step === 'form' && (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900">Connect a BigQuery View</h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Point to a view in BigQuery. The view should be in long format — one row per data point,
              with a learner email column. You&apos;ll assign column roles on the next step.
            </p>

            <div className="space-y-3">
              <Field label="Source name">
                <input autoFocus className={inputCls} placeholder="e.g. sensai Task Scores"
                  value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Billing project (where BQ jobs run)">
                <input className={inputCls} placeholder="hyperverge-chabtbot"
                  value={bqProject} onChange={(e) => setBqProject(e.target.value)} />
              </Field>
              <Field label="Dataset (project.dataset)">
                <input className={inputCls} placeholder="sensai-441917.sensai_prod"
                  value={bqDataset} onChange={(e) => setBqDataset(e.target.value)} />
              </Field>
              <Field label="View / table name">
                <input className={inputCls} placeholder="pulse_weekly_completion"
                  value={bqTable} onChange={(e) => setBqTable(e.target.value)} />
              </Field>
              <Field label="Row filter (optional SQL WHERE clause)">
                <input className={inputCls} placeholder="e.g. course_id IN (301, 319, 480, 481)"
                  value={bqFilter} onChange={(e) => setBqFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePreview()} />
              </Field>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={onClose} className={cancelBtn}>Cancel</button>
              <button onClick={handlePreview} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Connecting…' : 'Preview columns →'}
              </button>
            </div>
          </>
        )}

        {step === 'mapping' && (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900">Map columns</h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              Assign a role to each column. Dimension columns need a friendly label — that&apos;s
              what you&apos;ll see when building metric filters.
            </p>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {columns.map((col) => (
                <div key={col.column_name} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate font-mono text-xs text-zinc-700">
                      {col.column_name}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRole(col.column_name, r)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            col.role === r ? ROLE_ACTIVE[r] : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          }`}
                        >
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {col.role === 'dimension' && (
                    <input
                      className={`mt-2 ${inputCls}`}
                      placeholder="Friendly label, e.g. Course"
                      value={col.label}
                      onChange={(e) => setDimensionLabel(col.column_name, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setStep('form'); setError('') }} className={cancelBtn}>← Back</button>
              <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Saving…' : 'Save source'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Edit source modal ─────────────────────────────────────────────────────────

function EditSourceModal({ source, onClose }: { source: DataSource; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState(source.name)

  // Sheet fields
  const [sheetId, setSheetId] = useState(source.sheet_id ?? '')
  const [sheetTab, setSheetTab] = useState(source.sheet_tab ?? '')

  // BQ fields
  const [bqProject, setBqProject] = useState(source.bq_project ?? '')
  const [bqDataset, setBqDataset] = useState(source.bq_dataset ?? '')
  const [bqTable, setBqTable]     = useState(source.bq_table ?? '')
  const [bqFilter, setBqFilter]   = useState(source.bq_filter ?? '')

  const isBq = source.source_type === 'bigquery'

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!isBq && !sheetId.trim()) { setError('Sheet ID is required'); return }
    if (!isBq && !sheetTab.trim()) { setError('Tab name is required'); return }
    if (isBq && !bqProject.trim()) { setError('Billing project is required'); return }
    if (isBq && !bqDataset.trim()) { setError('Dataset is required'); return }
    if (isBq && !bqTable.trim()) { setError('View name is required'); return }
    setError('')
    startTransition(async () => {
      try {
        await updateDataSourceDetails(source.id, {
          name:      name.trim(),
          sheetId:   isBq ? undefined : sheetId.trim(),
          sheetTab:  isBq ? undefined : sheetTab.trim(),
          bqProject: isBq ? bqProject.trim() : undefined,
          bqDataset: isBq ? bqDataset.trim() : undefined,
          bqTable:   isBq ? bqTable.trim() : undefined,
          bqFilter:  isBq ? bqFilter.trim() : undefined,
        })
        onClose()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">Edit source</h2>

        <div className="space-y-3">
          <Field label="Source name">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          {isBq ? (
            <>
              <Field label="Billing project">
                <input className={inputCls} value={bqProject} onChange={(e) => setBqProject(e.target.value)} />
              </Field>
              <Field label="Dataset">
                <input className={inputCls} value={bqDataset} onChange={(e) => setBqDataset(e.target.value)} />
              </Field>
              <Field label="View / table name">
                <input className={inputCls} value={bqTable} onChange={(e) => setBqTable(e.target.value)} />
              </Field>
              <Field label="Row filter (optional SQL WHERE clause)">
                <input className={inputCls} placeholder="e.g. course_id IN (301, 319, 480, 481)"
                  value={bqFilter} onChange={(e) => setBqFilter(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Sheet ID">
                <input className={inputCls} value={sheetId} onChange={(e) => setSheetId(e.target.value)} />
              </Field>
              <Field label="Tab name">
                <input className={inputCls} value={sheetTab} onChange={(e) => setSheetTab(e.target.value)} />
              </Field>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className={cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers & constants ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  )
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const ROLES = ['learner_id', 'value', 'dimension', 'ignored'] as const

const ROLE_LABEL: Record<ColumnMapping['role'], string> = {
  learner_id: 'Learner ID',
  value:      'Value',
  dimension:  'Dimension',
  ignored:    'Ignore',
}

const ROLE_ACTIVE: Record<ColumnMapping['role'], string> = {
  learner_id: 'bg-[#5BAE5B] text-white',
  value:      'bg-blue-500 text-white',
  dimension:  'bg-violet-500 text-white',
  ignored:    'bg-zinc-400 text-white',
}

const inputCls  = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
const primaryBtn = 'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50'
const cancelBtn  = 'rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50'
