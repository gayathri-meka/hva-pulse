'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  startIntervention,
  saveInterventionStep1,
  clearInterventionStep1,
  saveInterventionStep2,
  saveActionItems,
  updateResurfaceDate,
  saveReview,
  closeIntervention,
  deleteIntervention,
} from '@/app/(protected)/learning/actions'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActionItem = {
  description:  string
  owner:        string
  due_date:     string | null
  completed_at: string | null
}

export type ReviewEntry = {
  at:                 string
  by:                 string | null
  by_name:            string | null
  note:               string
  new_resurface_date: string | null
}

export type Intervention = {
  id:                   string
  learner_id:           string
  status:               'open' | 'in_progress' | 'monitoring'
  root_cause_category:  string | null
  root_cause_notes:     string | null
  step1_completed_at:   string | null
  action_items:         ActionItem[]
  step2_completed_at:   string | null
  resurface_date:       string | null
  last_reviewed_at:     string | null
  reviews:              ReviewEntry[]
}

export type StaffUser = { id: string; name: string; role: string }

interface Props {
  learnerId:    string
  intervention: Intervention | null
  staffUsers:   StaffUser[]
}

const CATEGORIES = [
  'Life circumstance',
  'Content difficulty',
  'Motivation / confidence',
  'External commitments',
  'Other',
]

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function InterventionPanel({ learnerId, intervention, staffUsers }: Props) {
  const router = useRouter()
  const [isDeleting, startDelete] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const step1Done = !!intervention?.step1_completed_at
  const step2Done = !!intervention?.step2_completed_at

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
      <div className="grid grid-cols-3 gap-4">
        <Step1Card learnerId={learnerId} intervention={intervention} />
        <Step2Card intervention={intervention} locked={!step1Done} staffUsers={staffUsers} />
        <Step3Card intervention={intervention} locked={!step2Done} />
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete intervention?"
          message="All progress, root cause notes, and action items for this intervention will be permanently removed. This cannot be undone."
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

// ── Step 1: Root cause ─────────────────────────────────────────────────────────

function Step1Card({
  learnerId,
  intervention,
}: {
  learnerId:    string
  intervention: Intervention | null
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!intervention?.step1_completed_at
  const [editing, setEditing] = useState(!complete)
  const [category, setCategory] = useState(intervention?.root_cause_category ?? '')
  const [notes,    setNotes]    = useState(intervention?.root_cause_notes ?? '')
  const [error,    setError]    = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function handleStart() {
    startTrans(async () => {
      try { await startIntervention(learnerId); router.refresh() }
      catch (e) { setError(String(e)) }
    })
  }

  function handleSave() {
    if (!category) { setError('Select a category'); return }
    if (!notes.trim()) { setError('Notes are required'); return }
    if (!intervention) return
    startTrans(async () => {
      try {
        await saveInterventionStep1(intervention.id, {
          root_cause_category: category,
          root_cause_notes:    notes,
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
        <span className="text-sm font-semibold text-zinc-900">Root cause</span>
      </div>

      {/* No intervention yet */}
      {!intervention && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">No active intervention for this learner.</p>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <button onClick={handleStart} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Starting…' : 'Start intervention'}
          </button>
        </div>
      )}

      {/* Edit form */}
      {intervention && editing && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Category *</label>
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <svg
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes *</label>
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
              <button onClick={() => { setEditing(false); setError('') }} className={ghostBtn}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Read-only view */}
      {intervention && !editing && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">{intervention.root_cause_category}</p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Edit
              </button>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
          {intervention.root_cause_notes && (
            <p className="mt-1 text-xs text-zinc-500">{intervention.root_cause_notes}</p>
          )}
          {error && <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      )}

      {showClearConfirm && intervention && (
        <ConfirmDialog
          title="Delete root cause?"
          message="The category and notes for this intervention will be cleared. You can re-enter them anytime."
          confirmLabel="Delete root cause"
          isPending={isPending}
          error={error}
          onConfirm={() => {
            startTrans(async () => {
              try {
                await clearInterventionStep1(intervention.id)
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

// ── Step 2: Action plan ────────────────────────────────────────────────────────

function Step2Card({
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
  const complete = !!intervention?.step2_completed_at
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  // ── Initial setup items (before step2 complete) ──────────────────────────────
  const initItems = (): ActionItem[] => {
    if (intervention?.action_items?.length) {
      return intervention.action_items.map((ai) => ({
        ...ai,
        completed_at: (ai as ActionItem).completed_at ?? null,
      }))
    }
    return [{ description: '', owner: '', due_date: '', completed_at: null }]
  }

  const [items, setItems]         = useState<ActionItem[]>(initItems)
  const [setupError, setSetupErr] = useState('')

  // Set default due_date for blank items after mount
  useEffect(() => {
    if (!intervention?.action_items?.length) {
      setItems((prev) => prev.map((it) => it.due_date ? it : { ...it, due_date: defaultDueDate() }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Per-item edit state (after step2 complete) ───────────────────────────────
  // editingIdx: index of item being edited (-1 = new item being added)
  const [editingIdx,  setEditingIdx]  = useState<number | null>(null)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [editDraft,   setEditDraft]   = useState<ActionItem>({ description: '', owner: '', due_date: '', completed_at: null })
  const [editError,   setEditError]   = useState('')
  const [completingIdx, setCompletingIdx] = useState<number | null>(null)
  const [completionDate, setCompletionDate] = useState('')

  // Auto-open form when step1 completes (locked transitions false→false, complete stays false)
  useEffect(() => {
    if (!locked && !complete) {
      // Reset items if they're empty defaults (intervention just started)
      if (!intervention?.action_items?.length) {
        setItems([{ description: '', owner: '', due_date: defaultDueDate(), completed_at: null }])
      }
    }
  }, [locked, complete, intervention?.action_items?.length])

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={2} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Action plan</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 1 first.</p>
      </div>
    )
  }

  // ── Helper: save all items (for item-level saves when complete) ──────────────
  async function persistItems(updated: ActionItem[]) {
    if (!intervention) return
    if (complete) {
      await saveActionItems(intervention.id, updated)
    } else {
      await saveInterventionStep2(intervention.id, updated)
    }
  }

  // ── Initial setup handlers ───────────────────────────────────────────────────
  function addSetupItem() {
    setItems((prev) => [...prev, { description: '', owner: '', due_date: defaultDueDate(), completed_at: null }])
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
        await saveInterventionStep2(intervention.id, toSave)
        setSetupErr('')
        router.refresh()
      } catch (e) { setSetupErr(String(e)) }
    })
  }

  // ── Per-item handlers (complete state) ───────────────────────────────────────
  function startEdit(i: number) {
    setEditingIdx(i)
    setEditDraft({ ...items[i] })
    setEditError('')
  }

  function startAddItem() {
    setEditingIdx(-1)
    setEditDraft({ description: '', owner: '', due_date: defaultDueDate(), completed_at: null })
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
      // unmark done
      startTrans(async () => {
        try {
          const updated = items.map((item, idx) =>
            idx === i ? { ...item, completed_at: null } : item
          )
          await persistItems(updated)
          setItems(updated)
          router.refresh()
        } catch {}
      })
    } else {
      setCompletingIdx(i)
      setCompletionDate(today)
    }
  }

  function confirmDone() {
    if (completingIdx === null) return
    startTrans(async () => {
      try {
        const updated = items.map((item, idx) =>
          idx === completingIdx ? { ...item, completed_at: completionDate } : item
        )
        await persistItems(updated)
        setItems(updated)
        setCompletingIdx(null)
        router.refresh()
      } catch {}
    })
  }

  // ── Not complete: setup form ─────────────────────────────────────────────────
  if (!complete) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={2} done={false} active />
          <span className="text-sm font-semibold text-zinc-900">Action plan</span>
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
                  <button
                    onClick={() => removeSetupItem(i)}
                    className="shrink-0 text-zinc-300 hover:text-red-500"
                  >
                    ×
                  </button>
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

          <button
            onClick={handleSetupSave}
            disabled={isPending}
            className={primaryBtn}
          >
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

  // ── Complete: per-item view ──────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <StepBadge n={2} done={complete} active={!complete} />
        <span className="text-sm font-semibold text-zinc-900">Action plan</span>
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
                  <button
                    onClick={() => { setEditingIdx(null); setEditError('') }}
                    className={ghostBtn}
                  >
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
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() => startEdit(i)}
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setDeletingIdx(i); setDeleteError('') }}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Inline completion popup */}
              {isCompleting && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="mb-2 text-xs font-medium text-amber-800">When was this completed?</p>
                  <input
                    type="date"
                    className={inputCls}
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={confirmDone} disabled={isPending} className={primaryBtn}>
                      {isPending ? '…' : 'Mark done'}
                    </button>
                    <button
                      onClick={() => setCompletingIdx(null)}
                      className={ghostBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* New item being added */}
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
              <button
                onClick={() => { setEditingIdx(null); setEditError('') }}
                className={ghostBtn}
              >
                Cancel
              </button>
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
          message={`"${items[deletingIdx].description}" will be removed from this action plan. This cannot be undone.`}
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

// ── Step 3: Monitor ────────────────────────────────────────────────────────────

function Step3Card({
  intervention,
  locked,
}: {
  intervention: Intervention | null
  locked:       boolean
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const [showClose,   setShowClose]   = useState(false)
  const [outcome,     setOutcome]     = useState<'resolved' | 'dropped' | 'other'>('resolved')
  const [outcomeNote, setOutcomeNote] = useState('')
  const [error,       setError]       = useState('')
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  const [editingDate,  setEditingDate]  = useState(false)
  const [editDate,     setEditDate]     = useState('')
  const [showReview,   setShowReview]   = useState(false)
  const [reviewNote,   setReviewNote]   = useState('')
  const [reviewDate,   setReviewDate]   = useState('')
  const [extendInReview, setExtendInReview] = useState(false)

  function plusDays(iso: string, days: number): string {
    const d = new Date(iso)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={3} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Monitor</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 2 first.</p>
      </div>
    )
  }

  const needsReview = !!today && !!intervention?.resurface_date && intervention.resurface_date <= today
  const daysUntil   = today && intervention?.resurface_date
    ? Math.ceil(
        (new Date(intervention.resurface_date).getTime() - new Date(today).getTime()) / 86_400_000
      )
    : null

  function handleSaveDate() {
    if (!intervention) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) { setError('Pick a valid date'); return }
    startTrans(async () => {
      try {
        await updateResurfaceDate(intervention.id, editDate)
        setEditingDate(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  function handleSaveReview() {
    if (!intervention) return
    if (!reviewNote.trim()) { setError('Note is required'); return }
    const dateToSend = extendInReview ? reviewDate : null
    if (extendInReview && !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) {
      setError('Pick a valid date')
      return
    }
    startTrans(async () => {
      try {
        await saveReview(intervention.id, reviewNote, dateToSend)
        setShowReview(false)
        setReviewNote('')
        setReviewDate('')
        setExtendInReview(false)
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
    <div className={`rounded-xl border bg-white p-4 ${needsReview ? 'border-amber-300' : 'border-zinc-200'}`}>
      {needsReview && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">Needs review</p>
      )}
      <div className="mb-3 flex items-center gap-2">
        <StepBadge n={3} done={false} active />
        <span className="text-sm font-semibold text-zinc-900">Monitor</span>
      </div>

      <div className="space-y-3">
        {intervention?.resurface_date && (
          <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="text-zinc-400">Resurface date</div>
              {!editingDate && !showReview && !showClose && (
                <button
                  onClick={() => { setEditingDate(true); setEditDate(intervention.resurface_date ?? ''); setError('') }}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Edit
                </button>
              )}
            </div>
            {editingDate ? (
              <div className="mt-1 space-y-2">
                <input
                  type="date"
                  className={inputCls}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSaveDate} disabled={isPending} className={primaryBtn}>
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingDate(false); setError('') }}
                    className={ghostBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`mt-0.5 font-medium ${needsReview ? 'text-amber-700' : 'text-zinc-700'}`}>
                  {fmtDate(intervention.resurface_date)}
                </div>
                {daysUntil !== null && (
                  <div className={`mt-0.5 ${daysUntil < 0 ? 'text-amber-600' : 'text-zinc-400'}`}>
                    {daysUntil < 0
                      ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`
                      : daysUntil === 0
                      ? 'Due today'
                      : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!showClose && !showReview && !editingDate && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowReview(true)
                setReviewNote('')
                setReviewDate(intervention?.resurface_date ? plusDays(intervention.resurface_date, 7) : '')
                setExtendInReview(false)
                setError('')
              }}
              className={ghostBtn}
            >
              Review
            </button>
            <button onClick={() => { setShowClose(true); setError('') }} className={ghostBtn}>Close</button>
          </div>
        )}

        {showReview && (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <div>
              <label className={labelCls}>Review note *</label>
              <textarea
                className={`${inputCls} min-h-[60px] resize-y`}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="What's the latest update on this learner?"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={extendInReview}
                onChange={(e) => setExtendInReview(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span className="text-xs text-zinc-700">Also extend resurface date</span>
            </label>
            {extendInReview && (
              <input
                type="date"
                className={inputCls}
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            )}
            {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleSaveReview} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Saving…' : 'Save review'}
              </button>
              <button
                onClick={() => { setShowReview(false); setError('') }}
                className={ghostBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Review history */}
        {intervention && intervention.reviews && intervention.reviews.length > 0 && !showReview && !showClose && (
          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Review history ({intervention.reviews.length})
            </p>
            <ul className="space-y-1.5">
              {[...intervention.reviews].reverse().map((r, i) => (
                <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs">
                  <div className="flex items-baseline justify-between gap-2 text-[10px] text-zinc-400">
                    <span>{r.by_name ?? 'Staff'}</span>
                    <span>{fmtDate(r.at)}</span>
                  </div>
                  <p className="mt-0.5 text-zinc-700">{r.note}</p>
                  {r.new_resurface_date && (
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      Resurface date set to {fmtDate(r.new_resurface_date)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showClose && (
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            <div>
              <label className={labelCls}>Outcome</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  <option value="resolved">Resolved</option>
                  <option value="dropped">Dropped</option>
                  <option value="other">Other</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <label className={labelCls}>Note *</label>
              <textarea
                className={`${inputCls} min-h-[60px] resize-y`}
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="What happened?"
              />
            </div>
            {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="rounded-lg bg-[#5BAE5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4d9d4d] disabled:opacity-50"
              >
                {isPending ? 'Closing…' : 'Confirm close'}
              </button>
              <button onClick={() => { setShowClose(false); setError('') }} className={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}

        {error && !showClose && !showReview && !editingDate && <p className="text-xs text-[#E24B4A]">{error}</p>}
      </div>
    </div>
  )
}

// ── Shared ─────────────────────────────────────────────────────────────────────

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
        done   ? 'bg-[#5BAE5B] text-white' :
        active ? 'bg-zinc-900 text-white'  :
                 'bg-zinc-100 text-zinc-400'
      }`}
    >
      {done ? '✓' : n}
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  isPending,
  error,
  onConfirm,
  onCancel,
}: {
  title:        string
  message:      string
  confirmLabel?: string
  isPending:    boolean
  error?:       string
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
        <h2 className="mb-2 text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mb-5 text-sm text-zinc-500">{message}</p>
        {error && <p className="mb-3 text-xs text-[#E24B4A]">{error}</p>}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-[#E24B4A] px-4 py-2 text-sm font-medium text-white hover:bg-[#c43d3c] disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls   = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
const labelCls   = 'mb-1 block text-xs font-medium text-zinc-500'
const primaryBtn = 'rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50'
const ghostBtn   = 'rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50'
