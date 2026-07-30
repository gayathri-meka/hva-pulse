'use client'

import { useMemo, useState, useTransition } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import { updateCodingInterviewField } from './actions'
import { CODING_INTERVIEWERS, CODING_SCORES, type CodingInterviewField, type CodingInterviewRow } from '@/lib/codingInterviews'

const col = createColumnHelper<CodingInterviewRow>()
const inputClass = 'w-full min-w-[110px] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-[#5BAE5B] disabled:opacity-50'

export default function CodingInterviewsTable({ rows: initialRows }: { rows: CodingInterviewRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(email: string, field: CodingInterviewField, value: string | number | null) {
    setError(null)
    setRows((current) => current.map((row) => row.email === email ? { ...row, [field]: value } as CodingInterviewRow : row))
    startTransition(async () => {
      const result = await updateCodingInterviewField({ email, field, value })
      if (!result.ok) setError(result.error)
    })
  }

  const columns = useMemo(() => [
    col.accessor((r) => r.name ?? '—', { id: 'name', header: 'Name', size: 190, cell: (i) => <span className="font-medium text-zinc-900">{i.getValue()}</span> }),
    col.accessor('email', { header: 'Email', size: 240, cell: (i) => <span className="text-zinc-600">{i.getValue()}</span> }),
    col.accessor((r) => r.interviewStatus === 'not_started' ? 'Not Started' : 'Completed', {
      id: 'interviewStatus', header: 'Interview Status', size: 150, meta: { wrapHeader: true },
      cell: (i) => <SelectCell value={i.row.original.interviewStatus} options={[['not_started', 'Not Started'], ['completed', 'Completed']]} disabled={pending} onChange={(v) => save(i.row.original.email, 'interviewStatus', v)} />,
    }),
    col.accessor((r) => r.verdict ?? '', {
      id: 'verdict', header: 'Verdict', size: 130,
      cell: (i) => <SelectCell value={i.row.original.verdict ?? ''} placeholder="—" options={[['selected', 'Selected'], ['rejected', 'Rejected']]} disabled={pending} onChange={(v) => save(i.row.original.email, 'verdict', v || null)} />,
    }),
    col.accessor((r) => r.interviewDate ?? '', { id: 'date', header: 'Date', size: 145, enableColumnFilter: false, cell: (i) => <InputCell type="date" value={i.row.original.interviewDate ?? ''} disabled={pending} onSave={(v) => save(i.row.original.email, 'interviewDate', v || null)} /> }),
    col.accessor((r) => r.interviewTime ?? '', { id: 'time', header: 'Time', size: 125, enableColumnFilter: false, cell: (i) => <InputCell type="time" value={i.row.original.interviewTime ?? ''} disabled={pending} onSave={(v) => save(i.row.original.email, 'interviewTime', v || null)} /> }),
    col.accessor('preInterviewNotes', { header: 'Pre-Interview Notes', size: 260, meta: { wrapHeader: true }, cell: (i) => <TextCell value={i.getValue()} disabled={pending} placeholder="Add pre-interview notes…" onSave={(v) => save(i.row.original.email, 'preInterviewNotes', v)} /> }),
    col.accessor((r) => r.interviewer ?? '', { id: 'interviewer', header: 'Interviewer', size: 140, cell: (i) => <SelectCell value={i.row.original.interviewer ?? ''} placeholder="—" options={CODING_INTERVIEWERS.map((v) => [v, v])} disabled={pending} onChange={(v) => save(i.row.original.email, 'interviewer', v || null)} /> }),
    col.accessor('problemsAsked', { header: 'Problems Asked', size: 240, meta: { wrapHeader: true }, cell: (i) => <TextCell value={i.getValue()} disabled={pending} placeholder="Add problems asked…" onSave={(v) => save(i.row.original.email, 'problemsAsked', v)} /> }),
    col.accessor((r) => r.codingScore == null ? '' : String(r.codingScore), { id: 'codingScore', header: 'Coding Score', size: 135, meta: { wrapHeader: true }, cell: (i) => <ScoreCell value={i.row.original.codingScore} disabled={pending} onChange={(v) => save(i.row.original.email, 'codingScore', v)} /> }),
    col.accessor((r) => r.readingComprehensionScore == null ? '' : String(r.readingComprehensionScore), { id: 'readingComprehensionScore', header: 'Reading Comprehension Score', size: 190, meta: { wrapHeader: true }, cell: (i) => <ScoreCell value={i.row.original.readingComprehensionScore} disabled={pending} onChange={(v) => save(i.row.original.email, 'readingComprehensionScore', v)} /> }),
    col.accessor('learnabilityObservations', { header: 'Learnability Observations', size: 260, meta: { wrapHeader: true }, cell: (i) => <TextCell value={i.getValue()} disabled={pending} placeholder="Add observations…" onSave={(v) => save(i.row.original.email, 'learnabilityObservations', v)} /> }),
    col.accessor('notes', { header: 'Notes', size: 240, cell: (i) => <TextCell value={i.getValue()} disabled={pending} placeholder="Add notes…" onSave={(v) => save(i.row.original.email, 'notes', v)} /> }),
    col.accessor('summary', { header: 'Summary', size: 260, cell: (i) => <TextCell value={i.getValue()} disabled={pending} placeholder="Add summary…" onSave={(v) => save(i.row.original.email, 'summary', v)} /> }),
  ], [pending])

  return <div>{error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<DataTable data={rows} columns={columns} storageKey="coding-interviews-v2" getRowId={(r) => r.email} pinnedLeft={['name']} initialSorting={[{ id: 'name', desc: false }]} searchKeys={['name', 'email', 'interviewer']} searchPlaceholder="Search candidate or interviewer…" csvFilename="coding_interviews" emptyMessage="No coding interview candidates yet." showHeadersWhenEmpty /></div>
}

function SelectCell({ value, options, placeholder, disabled, onChange }: { value: string; options: readonly (readonly [string, string])[]; placeholder?: string; disabled: boolean; onChange: (value: string) => void }) {
  return <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputClass}>{placeholder != null && <option value="">{placeholder}</option>}{options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
}

function ScoreCell({ value, disabled, onChange }: { value: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={inputClass}><option value="">—</option>{CODING_SCORES.map((score) => <option key={score} value={score}>{score}</option>)}</select>
}

function InputCell({ value, type, disabled, onSave }: { value: string; type: 'date' | 'time'; disabled: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  return <input type={type} value={draft} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft) }} className={inputClass} />
}

function TextCell({ value, placeholder, disabled, onSave }: { value: string; placeholder: string; disabled: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  return <textarea value={draft} disabled={disabled} rows={3} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== value) onSave(draft) }} className={`${inputClass} min-w-[220px] resize-y whitespace-normal`} />
}
