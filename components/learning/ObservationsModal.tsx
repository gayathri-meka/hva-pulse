'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createObservation,
  updateObservation,
  deleteObservation,
} from '@/app/(protected)/learning/actions'
import {
  OBSERVATION_TYPES,
  OBSERVATION_SEVERITIES,
  OBSERVATION_TEAMS,
  OBSERVATION_TYPE_BADGE,
  OBSERVATION_SEVERITY_BADGE,
  type ObservationType,
  type ObservationSeverity,
  type ObservationTeam,
} from '@/lib/learning/observation-vocab'

export type Observation = {
  id:               string
  learner_id:       string
  author_id:        string
  author_name:      string | null
  observed_at:      string
  note:             string
  type:             string | null
  category:         string | null
  severity:         string | null
  accountable_team: string | null
}

interface Props {
  learnerId:       string
  learnerName:     string
  observations:    Observation[]
  currentUserId:   string
  currentUserName: string | null
  isAdmin:         boolean
  categories:      string[]
  onClose:         () => void
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

// State for the structured fields. Shared by both the "add new" form and
// inline edit.
type FieldState = {
  type:             ObservationType | ''
  category:         string
  severity:         ObservationSeverity | ''
  accountable_team: ObservationTeam | ''
}

const EMPTY_FIELDS: FieldState = {
  type: '', category: '', severity: '', accountable_team: '',
}

function fieldsFromObservation(o: Observation): FieldState {
  return {
    type:             (o.type as ObservationType | null) ?? '',
    category:         o.category ?? '',
    severity:         (o.severity as ObservationSeverity | null) ?? '',
    accountable_team: (o.accountable_team as ObservationTeam | null) ?? '',
  }
}

// Validates the user-input shape and returns the server-side payload, or an
// error string. Severity is required iff type is Concern.
function packFields(f: FieldState): { ok: true; value: { type: ObservationType; category: string; severity: ObservationSeverity | null; accountable_team: ObservationTeam | null } } | { ok: false; error: string } {
  if (!f.type)     return { ok: false, error: 'Pick a Type'       }
  if (!f.category) return { ok: false, error: 'Pick a Category'   }
  if (f.type === 'Concern' && !f.severity) {
    return { ok: false, error: 'Pick a Severity for this Concern' }
  }
  return {
    ok: true,
    value: {
      type:             f.type,
      category:         f.category,
      severity:         f.type === 'Concern' ? (f.severity as ObservationSeverity) : null,
      accountable_team: f.accountable_team || null,
    },
  }
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

function PrinciplesPanel() {
  return (
    <div className="border-b border-zinc-100 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/40 px-6 py-4">
      <p className="text-sm font-semibold text-zinc-800">
        💡 What&apos;s an observation?
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        A timestamped signal you noticed about a learner. Factual. Not an intervention. Not a conclusion.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-zinc-700 sm:grid-cols-2">
        <li className="flex items-start gap-2"><span>🪶</span><span>Keep them lightweight.</span></li>
        <li className="flex items-start gap-2"><span>🤝</span><span>No blame statements.</span></li>
        <li className="flex items-start gap-2"><span>📝</span><span>Don&apos;t change them silently. Edit history is preserved.</span></li>
        <li className="flex items-start gap-2"><span>🌱</span><span>Log the positive too.</span></li>
        <li className="flex items-start gap-2 sm:col-span-2"><span>🔍</span><span>Evidence, not diagnosis.</span></li>
      </ul>
    </div>
  )
}

const labelCls  = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500'
const selectCls = 'w-full appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400'
// Native date picker — browser supplies the calendar icon on the right, so we
// use the same shape as selectCls but skip the chevron padding/appearance.
const dateCls   = 'w-full rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-3 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'

const Chevron = () => (
  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  </div>
)

function FieldsRow({
  fields,
  onChange,
  categories,
  disabled = false,
}: {
  fields:     FieldState
  onChange:   (next: FieldState) => void
  categories: string[]
  disabled?:  boolean
}) {
  function patch(p: Partial<FieldState>) {
    const next = { ...fields, ...p }
    // Clear severity if type is not Concern.
    if (next.type !== 'Concern') next.severity = ''
    onChange(next)
  }

  const severityDisabled = disabled || fields.type !== 'Concern'

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Type *</label>
        <div className="relative">
          <select
            value={fields.type}
            onChange={(e) => patch({ type: e.target.value as ObservationType | '' })}
            className={selectCls}
            disabled={disabled}
          >
            <option value="">Select a type…</option>
            {OBSERVATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Chevron />
        </div>
      </div>

      <div>
        <label className={labelCls}>Category *</label>
        <div className="relative">
          <select
            value={fields.category}
            onChange={(e) => patch({ category: e.target.value })}
            className={selectCls}
            disabled={disabled}
          >
            <option value="">Select a category…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Chevron />
        </div>
      </div>

      <div>
        <label className={labelCls}>
          Severity {fields.type === 'Concern'
            ? '*'
            : <span className="text-zinc-400 normal-case">(concerns only)</span>}
        </label>
        <div className="relative">
          <select
            value={fields.severity}
            onChange={(e) => patch({ severity: e.target.value as ObservationSeverity | '' })}
            className={selectCls}
            disabled={severityDisabled}
          >
            <option value="">Select severity…</option>
            {OBSERVATION_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Chevron />
        </div>
      </div>

      <div>
        <label className={labelCls}>Accountable team</label>
        <div className="relative">
          <select
            value={fields.accountable_team}
            onChange={(e) => patch({ accountable_team: e.target.value as ObservationTeam | '' })}
            className={selectCls}
            disabled={disabled}
          >
            <option value="">Select a team…</option>
            {OBSERVATION_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Chevron />
        </div>
      </div>
    </div>
  )
}

function ObservationChips({ o }: { o: Observation }) {
  if (!o.type && !o.category && !o.severity && !o.accountable_team) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {o.type && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${OBSERVATION_TYPE_BADGE[o.type as ObservationType] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {o.type}
        </span>
      )}
      {o.category && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
          {o.category}
        </span>
      )}
      {o.severity && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${OBSERVATION_SEVERITY_BADGE[o.severity as ObservationSeverity] ?? 'bg-zinc-100 text-zinc-600'}`}>
          Severity: {o.severity}
        </span>
      )}
      {o.accountable_team && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
          {o.accountable_team} team
        </span>
      )}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

export default function ObservationsModal({
  learnerId,
  learnerName,
  observations: initialObservations,
  currentUserId,
  currentUserName,
  isAdmin,
  categories,
  onClose,
}: Props) {
  const router                  = useRouter()
  const [isPending, startTrans] = useTransition()
  const [items, setItems]       = useState<Observation[]>(
    [...initialObservations].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
  )
  const [newDate, setNewDate]   = useState(todayIso())
  const [newNote, setNewNote]   = useState('')
  const [newFields, setNewFields] = useState<FieldState>(EMPTY_FIELDS)
  const [error,   setError]     = useState('')

  const [editingId,  setEditingId]   = useState<string | null>(null)
  const [editDate,   setEditDate]    = useState('')
  const [editNote,   setEditNote]    = useState('')
  const [editFields, setEditFields]  = useState<FieldState>(EMPTY_FIELDS)

  // Custom delete confirmation — null means no prompt open, otherwise the
  // observation pending deletion.
  const [pendingDelete, setPendingDelete] = useState<Observation | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // Inner dialogs intercept Escape first so the outer modal doesn't dismiss
      // before the user has dismissed the prompt.
      if (pendingDelete) { setPendingDelete(null); return }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, pendingDelete])

  function handleAdd() {
    const trimmed = newNote.trim()
    if (!trimmed) { setError('Write something before saving'); return }
    const packed = packFields(newFields)
    if (!packed.ok) { setError(packed.error); return }
    setError('')
    startTrans(async () => {
      try {
        await createObservation(learnerId, newDate, trimmed, packed.value)
        const tempId = crypto.randomUUID()
        setItems((prev) => [
          {
            id:               tempId,
            learner_id:       learnerId,
            author_id:        currentUserId,
            author_name:      currentUserName,
            observed_at:      newDate,
            note:             trimmed,
            type:             packed.value.type,
            category:         packed.value.category,
            severity:         packed.value.severity,
            accountable_team: packed.value.accountable_team,
          },
          ...prev,
        ].sort((a, b) => b.observed_at.localeCompare(a.observed_at)))
        setNewNote('')
        setNewDate(todayIso())
        setNewFields(EMPTY_FIELDS)
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  function startEditing(o: Observation) {
    setEditingId(o.id)
    setEditDate(o.observed_at)
    setEditNote(o.note)
    setEditFields(fieldsFromObservation(o))
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditNote('')
    setEditFields(EMPTY_FIELDS)
    setError('')
  }

  function handleEdit(id: string) {
    const trimmed = editNote.trim()
    if (!trimmed) { setError('Write something before saving'); return }
    const packed = packFields(editFields)
    if (!packed.ok) { setError(packed.error); return }
    setError('')
    startTrans(async () => {
      try {
        await updateObservation(id, editDate, trimmed, packed.value)
        setItems((prev) => prev.map((o) =>
          o.id === id ? {
            ...o,
            observed_at:      editDate,
            note:             trimmed,
            type:             packed.value.type,
            category:         packed.value.category,
            severity:         packed.value.severity,
            accountable_team: packed.value.accountable_team,
          } : o
        ).sort((a, b) => b.observed_at.localeCompare(a.observed_at)))
        cancelEdit()
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setError('')
    startTrans(async () => {
      try {
        await deleteObservation(id)
        setItems((prev) => prev.filter((o) => o.id !== id))
        setPendingDelete(null)
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  const primaryBtn = 'rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40'
  const ghostBtn   = 'rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-800'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8">
      <div className="w-full max-w-5xl rounded-xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              Observations
              <span className="ml-2 text-xs font-medium text-zinc-400">
                {items.length} {items.length === 1 ? 'entry' : 'entries'}
              </span>
            </h2>
            <p className="text-xs text-zinc-500">{learnerName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <PrinciplesPanel />

        {/* 2-column body: form on the left, timeline on the right. Stacks on
            narrow screens so the form still appears above the timeline. */}
        <div className="grid grid-cols-1 divide-y divide-zinc-100 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {/* Add observation column */}
          <div className="px-6 py-4 lg:col-span-2">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-400">
              New observation
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Date of observation *</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  max={todayIso()}
                  className={dateCls}
                />
              </div>

              <FieldsRow fields={newFields} onChange={setNewFields} categories={categories} />

              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="What did you observe?"
                rows={3}
                className="resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />

              <div className="flex justify-end">
                <button onClick={handleAdd} disabled={isPending || !newNote.trim()} className={primaryBtn}>
                  {isPending ? 'Saving…' : 'Add observation'}
                </button>
              </div>

              {error && !editingId && <p className="text-xs text-[#E24B4A]">{error}</p>}
            </div>
          </div>

          {/* Timeline column */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Timeline
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No observations yet.</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((o) => {
                    const isMine     = o.author_id === currentUserId
                    const canModify  = isMine || isAdmin
                    const isEditing  = editingId === o.id
                    return (
                      <li key={o.id} className="rounded-lg bg-zinc-50 px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <div>
                              <label className={labelCls}>Date of observation *</label>
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                max={todayIso()}
                                className={dateCls}
                              />
                            </div>
                            <FieldsRow fields={editFields} onChange={setEditFields} categories={categories} />
                            <textarea
                              autoFocus
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              rows={3}
                              className="resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleEdit(o.id)} disabled={isPending || !editNote.trim()} className={primaryBtn}>
                                {isPending ? '…' : 'Save'}
                              </button>
                              <button onClick={cancelEdit} className={ghostBtn}>Cancel</button>
                            </div>
                            {error && editingId === o.id && <p className="text-xs text-[#E24B4A]">{error}</p>}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-xs">
                                <span className="font-medium text-zinc-800">{fmtDate(o.observed_at)}</span>
                                <span className="text-zinc-400">{' · '}{o.author_name ?? 'Unknown'}{isMine ? ' (you)' : ''}</span>
                              </div>
                              {canModify && (
                                <div className="flex shrink-0 items-center gap-2">
                                  <button onClick={() => startEditing(o)} className="text-xs text-zinc-400 hover:text-zinc-600">Edit</button>
                                  <button onClick={() => setPendingDelete(o)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                                </div>
                              )}
                            </div>
                            <ObservationChips o={o} />
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{o.note}</p>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog. Sits above the main modal, click outside
          or Cancel dismisses without deleting. */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-500">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900">Delete this observation?</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  This can&apos;t be undone. The note will be removed from the learner&apos;s timeline.
                </p>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <div className="text-[11px] text-zinc-500">
                    <span className="font-medium text-zinc-700">{fmtDate(pendingDelete.observed_at)}</span>
                    {pendingDelete.author_name && <span>{' · '}{pendingDelete.author_name}</span>}
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-700">
                    {pendingDelete.note}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={isPending}
                className={ghostBtn}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {isPending ? 'Deleting…' : 'Delete observation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
