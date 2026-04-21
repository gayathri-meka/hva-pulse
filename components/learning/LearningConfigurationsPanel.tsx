'use client'

import { useState, useTransition } from 'react'
import { saveLearningSettings } from '@/app/(protected)/learning/settings/actions'

// ── Reusable list editor ───────────────────────────────────────────────────────

function ListEditor({ title, description, settingsKey, initial, placeholder }: {
  title:       string
  description: string
  settingsKey: string
  initial:     string[]
  placeholder: string
}) {
  const [items, setItems]         = useState(initial)
  const [newItem, setNewItem]     = useState('')
  const [editing, setEditing]     = useState<number | null>(null)
  const [editVal, setEditVal]     = useState('')
  const [isPending, startTrans]   = useTransition()
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState('')

  function persist(next: string[]) {
    setItems(next)
    setSaveError('')
    startTrans(async () => {
      try {
        await saveLearningSettings(settingsKey, next)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    persist([...items, trimmed])
    setNewItem('')
  }

  function removeItem(i: number) {
    persist(items.filter((_, idx) => idx !== i))
  }

  function moveItem(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    persist(next)
  }

  function startEdit(i: number) {
    setEditing(i)
    setEditVal(items[i])
  }

  function saveEdit() {
    if (editing === null) return
    const trimmed = editVal.trim()
    if (!trimmed) return
    persist(items.map((v, i) => (i === editing ? trimmed : v)))
    setEditing(null)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
        <span className="text-xs">
          {isPending && <span className="text-zinc-400">Saving…</span>}
          {saved && !isPending && <span className="text-[#5BAE5B]">Saved</span>}
        </span>
      </div>
      <p className="mb-4 text-xs text-zinc-400">{description}</p>

      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
            {editing === i ? (
              <>
                <input
                  autoFocus
                  className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                />
                <button onClick={saveEdit} className="text-xs text-zinc-600 hover:text-zinc-900">Save</button>
                <button onClick={() => setEditing(null)} className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
              </>
            ) : (
              <>
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => moveItem(i, -1)}
                    disabled={i === 0 || isPending}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M8 3.293l-4.354 4.354a.5.5 0 0 0 .708.708L8 4.707l3.646 3.648a.5.5 0 0 0 .708-.708L8 3.293Z" clipRule="evenodd" /></svg>
                  </button>
                  <button
                    onClick={() => moveItem(i, 1)}
                    disabled={i === items.length - 1 || isPending}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M8 12.707l4.354-4.354a.5.5 0 0 1 .708.708l-5.008 5.008a.5.5 0 0 1-.708 0L2.338 9.061a.5.5 0 1 1 .708-.708L8 12.707Z" clipRule="evenodd" /></svg>
                  </button>
                </div>
                <span className="flex-1 text-sm text-zinc-700">{item}</span>
                <button onClick={() => startEdit(i)} disabled={isPending} className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-30">Edit</button>
                <button onClick={() => removeItem(i)} disabled={isPending} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30">Remove</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          disabled={isPending}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {saveError && <p className="mt-3 text-xs text-[#E24B4A]">{saveError}</p>}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface Props {
  categories:     string[]
  checklistItems: string[]
}

export default function LearningConfigurationsPanel({ categories, checklistItems }: Props) {
  return (
    <div className="space-y-6">
      <ListEditor
        title="Root Cause Categories"
        description="Shown in the 'Why?' dropdown when diagnosing an intervention. Admins pick from this list."
        settingsKey="root_cause_categories"
        initial={categories}
        placeholder="Add a category…"
      />
      <ListEditor
        title="Intervention Checklist Items"
        description="Shown as checkboxes in the 'What's wrong?' step. Staff tick which signals are off for the learner."
        settingsKey="intervention_checklist_items"
        initial={checklistItems}
        placeholder="Add a checklist item…"
      />
    </div>
  )
}
