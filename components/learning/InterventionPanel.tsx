'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  startIntervention,
  saveInterventionStep1,
  clearInterventionStep1,
  saveInterventionStep2,
  saveInterventionStep3,
  saveActionItems,
  updateDecisionDate,
  saveUpdate,
  closeIntervention,
  deleteIntervention,
} from '@/app/(protected)/learning/actions'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActionItem = {
  description:      string
  owner:            string
  due_date:         string | null
  completed_at:     string | null
  completion_notes: string | null
}

export type UpdateLogEntry = {
  at:                      string
  by:                      string | null
  by_name:                 string | null
  note:                    string
  decision_date_pushed_to: string | null
}

export type Intervention = {
  id:                    string
  learner_id:            string
  status:                'open' | 'in_progress' | 'follow_up'
  flagged_items:         string[]
  what_wrong_notes:      string | null
  root_cause_categories: string[]
  root_cause_notes:      string | null
  step1_completed_at:    string | null
  step2_completed_at:    string | null
  step3_completed_at:    string | null
  action_items:          ActionItem[]
  decision_date:         string | null
  last_reviewed_at:      string | null
  update_log:            UpdateLogEntry[]
}

export type StaffUser = { id: string; name: string; role: string }

interface Props {
  learnerId:      string
  intervention:   Intervention | null
  staffUsers:     StaffUser[]
  categories:     string[]
  checklistItems: string[]
}

// ── Shared style helpers ───────────────────────────────────────────────────────

const primaryBtn = 'rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors'
const ghostBtn   = 'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 transition-colors'
const inputCls   = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
const labelCls   = 'mb-1 block text-xs font-medium text-zinc-600'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5BAE5B]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-white">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
      active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
    }`}>
      {n}
    </span>
  )
}

function ConfirmDialog({ title, message, confirmLabel, isPending, error, onConfirm, onCancel }: {
  title:        string
  message:      string
  confirmLabel: string
  isPending:    boolean
  error:        string
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{message}</p>
        {error && <p className="mt-2 text-xs text-[#E24B4A]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onConfirm} disabled={isPending} className={`${primaryBtn} bg-red-600 hover:bg-red-700`}>
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
          <button onClick={onCancel} className={ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function InterventionPanel({ learnerId, intervention, staffUsers, categories, checklistItems }: Props) {
  const router = useRouter()
  const [isDeleting, startDelete] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const step1Done = !!intervention?.step1_completed_at
  const step2Done = !!intervention?.step2_completed_at
  const step3Done = !!intervention?.step3_completed_at

  function handleDeleteIntervention() {
    if (!intervention) return
    setDeleteError('')
    startDelete(async () => {
      try {
        await deleteIntervention(intervention.id)
        setShowDeleteConfirm(false)
        router.refresh()
      } catch (e) {
        setDeleteError(String(e))
      }
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Intervention</p>
        {intervention && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Delete intervention
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Step1Card learnerId={learnerId} intervention={intervention} checklistItems={checklistItems} />
        <Step2Card intervention={intervention} locked={!step1Done} categories={categories} />
        <Step3Card intervention={intervention} locked={!step2Done} staffUsers={staffUsers} />
        <Step4Card intervention={intervention} locked={!step3Done} />
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete intervention?"
          message="All progress, notes, and action items for this intervention will be permanently removed. This cannot be undone."
          confirmLabel="Delete intervention"
          isPending={isDeleting}
          error={deleteError}
          onConfirm={handleDeleteIntervention}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteError('') }}
        />
      )}
    </div>
  )
}

// ── Step 1: What's wrong? ──────────────────────────────────────────────────────

function Step1Card({
  learnerId,
  intervention,
  checklistItems,
}: {
  learnerId:      string
  intervention:   Intervention | null
  checklistItems: string[]
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!intervention?.step1_completed_at
  const [editing, setEditing] = useState(!complete)
  const [flagged, setFlagged] = useState<string[]>(intervention?.flagged_items ?? [])
  const [notes,   setNotes]   = useState(intervention?.what_wrong_notes ?? '')
  const [error,   setError]   = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function toggleItem(item: string) {
    setFlagged((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    )
  }

  function handleStart() {
    startTrans(async () => {
      try { await startIntervention(learnerId); router.refresh() }
      catch (e) { setError(String(e)) }
    })
  }

  function handleSave() {
    if (flagged.length === 0 && !notes.trim()) {
      setError('Select at least one item or add a note')
      return
    }
    if (!intervention) return
    startTrans(async () => {
      try {
        await saveInterventionStep1(intervention.id, {
          flagged_items:    flagged,
          what_wrong_notes: notes,
        })
        setEditing(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <StepBadge n={1} done={complete} active={!complete} />
        <span className="text-sm font-semibold text-zinc-900">What&apos;s wrong?</span>
      </div>

      {!intervention && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">No active intervention for this learner.</p>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <button onClick={handleStart} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Starting…' : 'Start intervention'}
          </button>
        </div>
      )}

      {intervention && editing && (
        <div className="space-y-3">
          {checklistItems.length > 0 && (
            <div>
              <label className={labelCls}>Flag the signals that are off</label>
              <div className="space-y-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                {checklistItems.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={flagged.includes(item)}
                      onChange={() => toggleItem(item)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                    />
                    <span className="text-sm text-zinc-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Additional notes</label>
            <textarea
              className={`${inputCls} min-h-[72px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other observations…"
            />
          </div>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
              {isPending ? 'Saving…' : complete ? 'Save' : 'Save and continue'}
            </button>
            {complete && (
              <button onClick={() => { setEditing(false); setError('') }} className={ghostBtn}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {intervention && !editing && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {flagged.length > 0 && (
                <ul className="space-y-0.5">
                  {flagged.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {notes && (
                <p className="mt-1.5 text-xs text-zinc-500">{notes}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button onClick={() => setEditing(true)} className="text-xs text-zinc-400 hover:text-zinc-600">
                Edit
              </button>
              <button onClick={() => setShowClearConfirm(true)} className="text-xs text-red-400 hover:text-red-600">
                Delete
              </button>
            </div>
          </div>
          {error && <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      )}

      {showClearConfirm && intervention && (
        <ConfirmDialog
          title="Delete 'What's wrong?' data?"
          message="The flagged items and notes for this step will be cleared. You can re-enter them anytime."
          confirmLabel="Delete"
          isPending={isPending}
          error={error}
          onConfirm={() => {
            startTrans(async () => {
              try {
                await clearInterventionStep1(intervention.id)
                setFlagged([])
                setNotes('')
                setShowClearConfirm(false)
                setError('')
                router.refresh()
              } catch (e) { setError(String(e)) }
            })
          }}
          onCancel={() => { setShowClearConfirm(false); setError('') }}
        />
      )}
    </div>
  )
}

// ── Step 2: Why? ───────────────────────────────────────────────────────────────

function Step2Card({
  intervention,
  locked,
  categories,
}: {
  intervention: Intervention | null
  locked:       boolean
  categories:   string[]
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!intervention?.step2_completed_at
  const [editing,    setEditing]    = useState(!complete)
  const [selected,   setSelected]   = useState<string[]>(intervention?.root_cause_categories ?? [])
  const [notes,      setNotes]      = useState(intervention?.root_cause_notes ?? '')
  const [error,      setError]      = useState('')

  function toggleCategory(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={2} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Why?</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 1 first.</p>
      </div>
    )
  }

  function handleSave() {
    if (selected.length === 0 && !notes.trim()) { setError('Select at least one category or add a note'); return }
    if (!intervention) return
    startTrans(async () => {
      try {
        await saveInterventionStep2(intervention.id, {
          root_cause_categories: selected,
          root_cause_notes:      notes,
        })
        setEditing(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <StepBadge n={2} done={complete} active={!complete} />
        <span className="text-sm font-semibold text-zinc-900">Why?</span>
      </div>

      {intervention && editing && (
        <div className="space-y-3">
          {categories.length > 0 && (
            <div>
              <label className={labelCls}>Root cause categories</label>
              <div className="space-y-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                {categories.map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                    />
                    <span className="text-sm text-zinc-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's driving the issue?"
            />
          </div>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
              {isPending ? 'Saving…' : complete ? 'Save' : 'Save and continue'}
            </button>
            {complete && (
              <button onClick={() => { setEditing(false); setError('') }} className={ghostBtn}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {intervention && !editing && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {selected.length > 0 && (
                <ul className="space-y-0.5">
                  {selected.map((cat) => (
                    <li key={cat} className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {cat}
                    </li>
                  ))}
                </ul>
              )}
              {notes && (
                <p className="mt-1.5 text-xs text-zinc-500">{notes}</p>
              )}
            </div>
            <button onClick={() => setEditing(true)} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600">
              Edit
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Step 3: What next? ─────────────────────────────────────────────────────────

function Step3Card({
  intervention,
  locked,
  staffUsers,
}: {
  intervention: Intervention | null
  locked:       boolean
  staffUsers:   StaffUser[]
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!intervention?.step3_completed_at
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  const initItems = (): ActionItem[] => {
    if (intervention?.action_items?.length) {
      return intervention.action_items.map((ai) => ({
        ...ai,
        completed_at: (ai as ActionItem).completed_at ?? null,
      }))
    }
    return [{ description: '', owner: '', due_date: '', completed_at: null, completion_notes: null }]
  }

  const [items, setItems]         = useState<ActionItem[]>(initItems)
  const [setupError, setSetupErr] = useState('')

  useEffect(() => {
    if (!intervention?.action_items?.length) {
      setItems((prev) => prev.map((it) => it.due_date ? it : { ...it, due_date: defaultDueDate() }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [editingIdx,    setEditingIdx]    = useState<number | null>(null)
  const [deletingIdx,   setDeletingIdx]   = useState<number | null>(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [editDraft,     setEditDraft]     = useState<ActionItem>({ description: '', owner: '', due_date: '', completed_at: null, completion_notes: null })
  const [editError,     setEditError]     = useState('')
  const [completingIdx,   setCompletingIdx]   = useState<number | null>(null)
  const [completionDate,  setCompletionDate]  = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  useEffect(() => {
    if (!locked && !complete && !intervention?.action_items?.length) {
      setItems([{ description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null }])
    }
  }, [locked, complete, intervention?.action_items?.length])

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={3} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">What next?</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 2 first.</p>
      </div>
    )
  }

  async function persistItems(updated: ActionItem[]) {
    if (!intervention) return
    if (complete) {
      await saveActionItems(intervention.id, updated)
    } else {
      await saveInterventionStep3(intervention.id, updated)
    }
  }

  function addSetupItem() {
    setItems((prev) => [...prev, { description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null }])
  }

  function removeSetupItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateSetupItem(i: number, field: keyof ActionItem, val: string | null) {
    setItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item))
    )
  }

  function handleSetupSave() {
    if (!intervention) return
    const valid = items.filter((item) => item.description.trim() && item.owner.trim() && item.due_date)
    if (valid.length === 0) { setSetupErr('Add at least one complete action item'); return }
    const incomplete = items.findIndex((item) => item.description.trim() && (!item.owner.trim() || !item.due_date))
    if (incomplete >= 0) { setSetupErr('Owner and due date are required for each item'); return }
    startTrans(async () => {
      try {
        const toSave = items.filter((item) => item.description.trim())
        await saveInterventionStep3(intervention.id, toSave)
        setSetupErr('')
        router.refresh()
      } catch (e) { setSetupErr(String(e)) }
    })
  }

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditDraft({ ...items[i] })
    setEditError('')
  }

  function startAddItem() {
    setEditingIdx(-1)
    setEditDraft({ description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null })
    setEditError('')
  }

  function handleItemSave() {
    if (!editDraft.description.trim()) { setEditError('Description is required'); return }
    if (!editDraft.owner.trim())       { setEditError('Owner is required'); return }
    if (!editDraft.due_date)           { setEditError('Due date is required'); return }
    startTrans(async () => {
      try {
        let updated: ActionItem[]
        if (editingIdx === -1) {
          updated = [...items, { ...editDraft }]
        } else {
          updated = items.map((item, i) => (i === editingIdx ? { ...editDraft } : item))
        }
        await persistItems(updated)
        setItems(updated)
        setEditingIdx(null)
        setEditError('')
        router.refresh()
      } catch (e) { setEditError(String(e)) }
    })
  }

  function handleCheckbox(i: number) {
    if (items[i].completed_at) {
      startTrans(async () => {
        try {
          const updated = items.map((item, idx) => idx === i ? { ...item, completed_at: null, completion_notes: null } : item)
          await persistItems(updated)
          setItems(updated)
          router.refresh()
        } catch {}
      })
    } else {
      setCompletingIdx(i)
      setCompletionDate(today)
      setCompletionNotes('')
    }
  }

  function confirmDone() {
    if (completingIdx === null) return
    startTrans(async () => {
      try {
        const updated = items.map((item, idx) =>
          idx === completingIdx
            ? { ...item, completed_at: completionDate, completion_notes: completionNotes.trim() || null }
            : item
        )
        await persistItems(updated)
        setItems(updated)
        setCompletingIdx(null)
        setCompletionNotes('')
        router.refresh()
      } catch {}
    })
  }

  // ── Setup form (before step3 complete) ───────────────────────────────────────
  if (!complete) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={3} done={false} active />
          <span className="text-sm font-semibold text-zinc-900">What next?</span>
        </div>

        <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          {items.map((item, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Description *"
                  value={item.description}
                  onChange={(e) => updateSetupItem(i, 'description', e.target.value)}
                />
                {items.length > 1 && (
                  <button onClick={() => removeSetupItem(i)} className="shrink-0 text-zinc-300 hover:text-red-500">×</button>
                )}
              </div>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={item.owner}
                  onChange={(e) => updateSetupItem(i, 'owner', e.target.value)}
                >
                  <option value="">Owner *</option>
                  {staffUsers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="date"
                className={inputCls}
                value={item.due_date ?? ''}
                onChange={(e) => updateSetupItem(i, 'due_date', e.target.value || null)}
              />
            </div>
          ))}

          {setupError && <p className="text-xs text-[#E24B4A]">{setupError}</p>}

          <button onClick={handleSetupSave} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Saving…' : 'Save and continue'}
          </button>
        </div>

        <button
          onClick={addSetupItem}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span>+</span> Add item
        </button>
      </div>
    )
  }

  // ── Complete: per-item view ───────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <StepBadge n={3} done={complete} active={!complete} />
        <span className="text-sm font-semibold text-zinc-900">What next?</span>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const isEditing    = editingIdx === i
          const isCompleting = completingIdx === i

          if (isEditing) {
            return (
              <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                <input
                  className={inputCls}
                  placeholder="Description *"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={editDraft.owner}
                    onChange={(e) => setEditDraft((d) => ({ ...d, owner: e.target.value }))}
                  >
                    <option value="">Owner *</option>
                    {staffUsers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="date"
                  className={inputCls}
                  value={editDraft.due_date ?? ''}
                  onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value || null }))}
                />
                {editError && <p className="text-xs text-[#E24B4A]">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleItemSave} disabled={isPending} className={primaryBtn}>
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingIdx(null); setEditError('') }} className={ghostBtn}>
                    Cancel
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!item.completed_at}
                  onChange={() => handleCheckbox(i)}
                  disabled={isPending}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 accent-[#5BAE5B]"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${item.completed_at ? 'text-zinc-400 line-through' : 'font-medium text-zinc-800'}`}>
                    {item.description}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    {item.owner    && <span>{item.owner}</span>}
                    {item.due_date && <span>Due {fmtDate(item.due_date)}</span>}
                    {item.completed_at && <span className="text-[#5BAE5B]">Done {fmtDate(item.completed_at)}</span>}
                  </div>
                  {item.completed_at && item.completion_notes && (
                    <p className="mt-1 text-xs text-zinc-400 italic">{item.completion_notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => startEdit(i)} className="text-xs text-zinc-400 hover:text-zinc-600">
                    Edit
                  </button>
                  <button onClick={() => { setDeletingIdx(i); setDeleteError('') }} className="text-xs text-red-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>

              {isCompleting && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="mb-2 text-xs font-medium text-amber-800">When was this completed?</p>
                  <input
                    type="date"
                    className={inputCls}
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                  />
                  <textarea
                    className={`${inputCls} mt-1.5 resize-none`}
                    rows={2}
                    placeholder="Notes (optional)"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={confirmDone} disabled={isPending} className={primaryBtn}>
                      {isPending ? '…' : 'Mark done'}
                    </button>
                    <button onClick={() => setCompletingIdx(null)} className={ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {editingIdx === -1 && (
          <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
            <input
              className={inputCls}
              placeholder="Description *"
              value={editDraft.description}
              onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                value={editDraft.owner}
                onChange={(e) => setEditDraft((d) => ({ ...d, owner: e.target.value }))}
              >
                <option value="">Owner *</option>
                {staffUsers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="date"
              className={inputCls}
              value={editDraft.due_date ?? ''}
              onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value || null }))}
            />
            {editError && <p className="text-xs text-[#E24B4A]">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={handleItemSave} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingIdx(null); setEditError('') }} className={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {editingIdx === null && (
        <button
          onClick={startAddItem}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span>+</span> Add another item
        </button>
      )}

      {deletingIdx !== null && items[deletingIdx] && (
        <ConfirmDialog
          title="Delete action item?"
          message={`"${items[deletingIdx].description}" will be removed. This cannot be undone.`}
          confirmLabel="Delete item"
          isPending={isPending}
          error={deleteError}
          onConfirm={() => {
            const idx = deletingIdx
            startTrans(async () => {
              try {
                const updated = items.filter((_, i) => i !== idx)
                await persistItems(updated)
                setItems(updated)
                setDeletingIdx(null)
                setDeleteError('')
                router.refresh()
              } catch (e) { setDeleteError(String(e)) }
            })
          }}
          onCancel={() => { setDeletingIdx(null); setDeleteError('') }}
        />
      )}
    </div>
  )
}

// ── Step 4: Follow-up ──────────────────────────────────────────────────────────

function Step4Card({
  intervention,
  locked,
}: {
  intervention: Intervention | null
  locked:       boolean
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  const [editingDate,     setEditingDate]     = useState(false)
  const [editDate,        setEditDate]        = useState('')
  const [showAddUpdate,   setShowAddUpdate]   = useState(false)
  const [updateNote,      setUpdateNote]      = useState('')
  const [extendInUpdate,  setExtendInUpdate]  = useState(false)
  const [updateNewDate,   setUpdateNewDate]   = useState('')
  const [showClose,       setShowClose]       = useState(false)
  const [outcome,         setOutcome]         = useState<'resolved' | 'dropped' | 'other'>('resolved')
  const [outcomeNote,     setOutcomeNote]     = useState('')
  const [error,           setError]           = useState('')

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={4} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Follow-up</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 3 first.</p>
      </div>
    )
  }

  const decisionDate = intervention?.decision_date ?? null
  const daysUntil    = today && decisionDate
    ? Math.ceil((new Date(decisionDate).getTime() - new Date(today).getTime()) / 86_400_000)
    : null
  const isOverdue    = daysUntil !== null && daysUntil < 0

  const daysChipCls = daysUntil === null        ? 'bg-zinc-100 text-zinc-500'
    : daysUntil < 0                             ? 'bg-red-100 text-red-700'
    : daysUntil <= 3                            ? 'bg-amber-100 text-amber-700'
    :                                             'bg-emerald-100 text-emerald-700'

  const daysText = daysUntil === null ? ''
    : daysUntil < 0  ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`
    : daysUntil === 0 ? 'Due today'
    :                   `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`

  const actionItems   = intervention?.action_items ?? []
  const totalItems    = actionItems.length
  const doneItems     = actionItems.filter((it) => !!it.completed_at).length
  const twoDaysLater  = today
    ? new Date(new Date(today).getTime() + 2 * 86_400_000).toISOString().slice(0, 10)
    : ''
  const nearDue = today
    ? actionItems.filter((it) => !it.completed_at && it.due_date && it.due_date <= twoDaysLater)
    : []

  const updateLog = intervention?.update_log ?? []

  function handleSaveDate() {
    if (!intervention) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) { setError('Pick a valid date'); return }
    startTrans(async () => {
      try {
        await updateDecisionDate(intervention.id, editDate)
        setEditingDate(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  function handleAddUpdate() {
    if (!intervention) return
    if (!updateNote.trim()) { setError('Note is required'); return }
    const dateToSend = extendInUpdate ? updateNewDate : null
    if (extendInUpdate && !/^\d{4}-\d{2}-\d{2}$/.test(updateNewDate)) {
      setError('Pick a valid date'); return
    }
    startTrans(async () => {
      try {
        await saveUpdate(intervention.id, updateNote, dateToSend)
        setShowAddUpdate(false)
        setUpdateNote('')
        setExtendInUpdate(false)
        setUpdateNewDate('')
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  function handleClose() {
    if (!intervention) return
    if (!outcomeNote.trim()) { setError('Note is required'); return }
    startTrans(async () => {
      try {
        await closeIntervention(intervention.id, intervention.learner_id, outcome, outcomeNote)
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${isOverdue ? 'border-amber-300' : 'border-zinc-200'}`}>
      <div className="mb-4 flex items-center gap-2">
        <StepBadge n={4} done={false} active />
        <span className="text-sm font-semibold text-zinc-900">Follow-up</span>
      </div>

      <div className="space-y-4">

        {/* ── Section 1: Decision date ── */}
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Decision date</span>
            {!editingDate && !showAddUpdate && !showClose && (
              <button
                onClick={() => { setEditingDate(true); setEditDate(decisionDate ?? ''); setError('') }}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Edit
              </button>
            )}
          </div>
          {editingDate ? (
            <div className="mt-2 space-y-2">
              <input type="date" className={inputCls} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSaveDate} disabled={isPending} className={primaryBtn}>{isPending ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setEditingDate(false); setError('') }} className={ghostBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-800">
                {decisionDate ? fmtDate(decisionDate) : '—'}
              </span>
              {daysText && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${daysChipCls}`}>
                  {daysText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Section 2: Action items summary ── */}
        {totalItems > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>{doneItems} of {totalItems} action item{totalItems !== 1 ? 's' : ''} completed</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[#5BAE5B] transition-all"
                style={{ width: `${Math.round((doneItems / totalItems) * 100)}%` }}
              />
            </div>
            {nearDue.map((item, i) => (
              <p key={i} className="flex items-start gap-1 text-xs text-amber-700">
                <span className="shrink-0">⚠</span>
                <span>
                  Due in 2 days{item.owner ? `: ${item.owner} — ` : ': '}{item.description}
                </span>
              </p>
            ))}
          </div>
        )}

        {/* ── Section 3: Update log ── */}
        <div>
          {updateLog.length > 0 && (
            <ul className="mb-3 space-y-2.5 border-t border-zinc-100 pt-3">
              {updateLog.map((entry, i) => (
                <li key={i} className="text-xs">
                  <span className="text-zinc-400">
                    {fmtDate(entry.at)}{entry.by_name ? ` · ${entry.by_name}` : ''}
                  </span>
                  <p className="mt-0.5 text-zinc-700">{entry.note}</p>
                  {entry.decision_date_pushed_to && (
                    <p className="mt-0.5 text-zinc-400">
                      Decision date pushed to {fmtDate(entry.decision_date_pushed_to)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!editingDate && !showClose && (
            showAddUpdate ? (
              <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <textarea
                  autoFocus
                  className={`${inputCls} min-h-[72px] resize-y`}
                  placeholder="What was discussed? What's the current status?"
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={extendInUpdate}
                    onChange={(e) => setExtendInUpdate(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                  />
                  Push decision date
                </label>
                {extendInUpdate && (
                  <input
                    type="date"
                    className={inputCls}
                    value={updateNewDate}
                    onChange={(e) => setUpdateNewDate(e.target.value)}
                  />
                )}
                {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAddUpdate} disabled={isPending} className={primaryBtn}>
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowAddUpdate(false); setError('') }} className={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddUpdate(true); setUpdateNote(''); setExtendInUpdate(false); setUpdateNewDate(''); setError('') }}
                  className={ghostBtn}
                >
                  + Add update
                </button>
                <button
                  onClick={() => { setShowClose(true); setError('') }}
                  className={`${ghostBtn} border-red-200 text-red-600 hover:bg-red-50`}
                >
                  Close intervention
                </button>
              </div>
            )
          )}
        </div>

        {/* ── Close intervention form ── */}
        {!showAddUpdate && !editingDate && showClose && (
          <div>
            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <label className={labelCls}>Outcome</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  <option value="resolved">Resolved</option>
                  <option value="dropped">Dropped out</option>
                  <option value="other">Other</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <label className={labelCls}>Note *</label>
              <textarea
                className={`${inputCls} min-h-[72px] resize-y`}
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="Describe the outcome…"
              />
              {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleClose} disabled={isPending} className={`${primaryBtn} bg-red-600 hover:bg-red-700`}>
                  {isPending ? 'Closing…' : 'Close intervention'}
                </button>
                <button onClick={() => { setShowClose(false); setError('') }} className={ghostBtn}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
