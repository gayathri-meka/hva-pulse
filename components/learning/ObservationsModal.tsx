'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createObservation,
  updateObservation,
  deleteObservation,
} from '@/app/(protected)/learning/actions'

export type Observation = {
  id:          string
  learner_id:  string
  author_id:   string
  author_name: string | null
  observed_at: string
  note:        string
}

interface Props {
  learnerId:       string
  learnerName:     string
  observations:    Observation[]
  currentUserId:   string
  currentUserName: string | null
  isAdmin:         boolean
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

export default function ObservationsModal({
  learnerId,
  learnerName,
  observations: initialObservations,
  currentUserId,
  currentUserName,
  isAdmin,
  onClose,
}: Props) {
  const router                  = useRouter()
  const [isPending, startTrans] = useTransition()
  const [items, setItems]       = useState<Observation[]>(
    [...initialObservations].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
  )
  const [newDate, setNewDate]   = useState(todayIso())
  const [newNote, setNewNote]   = useState('')
  const [error,   setError]     = useState('')
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editDate,   setEditDate]   = useState('')
  const [editNote,   setEditNote]   = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleAdd() {
    const trimmed = newNote.trim()
    if (!trimmed) { setError('Write something before saving'); return }
    setError('')
    startTrans(async () => {
      try {
        await createObservation(learnerId, newDate, trimmed)
        // Insert optimistically — refresh will reconcile with the server
        const tempId = crypto.randomUUID()
        setItems((prev) => [
          {
            id:          tempId,
            learner_id:  learnerId,
            author_id:   currentUserId,
            author_name: currentUserName,
            observed_at: newDate,
            note:        trimmed,
          },
          ...prev,
        ].sort((a, b) => b.observed_at.localeCompare(a.observed_at)))
        setNewNote('')
        setNewDate(todayIso())
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  function startEditing(o: Observation) {
    setEditingId(o.id)
    setEditDate(o.observed_at)
    setEditNote(o.note)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditNote('')
    setError('')
  }

  function handleEdit(id: string) {
    const trimmed = editNote.trim()
    if (!trimmed) { setError('Write something before saving'); return }
    setError('')
    startTrans(async () => {
      try {
        await updateObservation(id, editDate, trimmed)
        setItems((prev) => prev.map((o) =>
          o.id === id ? { ...o, observed_at: editDate, note: trimmed } : o
        ).sort((a, b) => b.observed_at.localeCompare(a.observed_at)))
        cancelEdit()
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this observation?')) return
    setError('')
    startTrans(async () => {
      try {
        await deleteObservation(id)
        setItems((prev) => prev.filter((o) => o.id !== id))
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    })
  }

  const primaryBtn = 'rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40'
  const ghostBtn   = 'rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-800'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Observations</h2>
            <p className="text-xs text-zinc-500">{learnerName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Add new */}
        <div className="border-b border-zinc-100 px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                max={todayIso()}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <span className="text-xs text-zinc-400">Date of observation</span>
            </div>
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
          </div>
        </div>

        {/* Timeline */}
        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
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
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          max={todayIso()}
                          className="w-fit rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        />
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
                              <button onClick={() => handleDelete(o.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                            </div>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{o.note}</p>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p className="mt-2 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      </div>
    </div>
  )
}
