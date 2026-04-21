'use client'

import { useState, useTransition } from 'react'
import { saveLearningSettings } from '@/app/(protected)/learning/settings/actions'

interface Props {
  initial: string[]
}

export default function LearningCategoriesPanel({ initial }: Props) {
  const [items, setItems]       = useState(initial)
  const [newItem, setNewItem]   = useState('')
  const [editing, setEditing]   = useState<number | null>(null)
  const [editVal, setEditVal]   = useState('')
  const [isPending, startTrans] = useTransition()
  const [saved, setSaved]       = useState(false)

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    setItems((prev) => [...prev, trimmed])
    setNewItem('')
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function moveItem(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function startEdit(i: number) {
    setEditing(i)
    setEditVal(items[i])
  }

  function saveEdit() {
    if (editing === null) return
    const trimmed = editVal.trim()
    if (!trimmed) return
    setItems((prev) => prev.map((v, i) => (i === editing ? trimmed : v)))
    setEditing(null)
  }

  function handleSave() {
    startTrans(async () => {
      await saveLearningSettings('root_cause_categories', items)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900">Root Cause Categories</h3>
        {saved && <span className="text-xs text-[#5BAE5B]">Saved</span>}
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        Shown in the root cause dropdown when creating or editing an intervention. Admins pick from this list.
      </p>

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
                    disabled={i === 0}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M8 3.293l-4.354 4.354a.5.5 0 0 0 .708.708L8 4.707l3.646 3.648a.5.5 0 0 0 .708-.708L8 3.293Z" clipRule="evenodd" /></svg>
                  </button>
                  <button
                    onClick={() => moveItem(i, 1)}
                    disabled={i === items.length - 1}
                    className="text-zinc-300 hover:text-zinc-600 disabled:opacity-30"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M8 12.707l4.354-4.354a.5.5 0 0 1 .708.708l-5.008 5.008a.5.5 0 0 1-.708 0L2.338 9.061a.5.5 0 1 1 .708-.708L8 12.707Z" clipRule="evenodd" /></svg>
                  </button>
                </div>
                <span className="flex-1 text-sm text-zinc-700">{item}</span>
                <button onClick={() => startEdit(i)} className="text-xs text-zinc-400 hover:text-zinc-600">Edit</button>
                <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="Add a category…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
        >
          Add
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
