'use client'

import { useState, useTransition } from 'react'
import { addProspectComment, deleteProspectComment } from '@/app/(protected)/admissions/actions'
import type { ProspectComment } from '@/lib/prospectComments'

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CommentsCell({
  email,
  comments,
  currentUserId,
  isAdmin,
}: {
  email: string | null
  comments: ProspectComment[]
  currentUserId: string
  isAdmin: boolean
}) {
  const [items, setItems] = useState<ProspectComment[]>(comments)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // No email → nothing to key a thread on.
  if (!email) return <span className="text-zinc-300">—</span>

  function submit() {
    const text = draft.trim()
    if (!text || pending) return
    setError(null)
    startTransition(async () => {
      const res = await addProspectComment(email as string, text)
      if (res.ok) {
        setItems((prev) => [res.comment, ...prev])
        setDraft('')
      } else {
        setError(res.error)
      }
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteProspectComment(id)
      if (res.ok) setItems((prev) => prev.filter((c) => c.id !== id))
      else setError(res.error)
    })
  }

  const count = items.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
          count > 0
            ? 'border-[#5BAE5B]/40 bg-[#E1F5EE] text-[#085041] hover:bg-[#d3efe5]'
            : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
        }`}
        title={count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : 'Add a comment'}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M10 2c-4.418 0-8 2.91-8 6.5 0 1.62.73 3.1 1.94 4.23-.12.96-.5 1.86-1.1 2.6a.5.5 0 0 0 .46.81 6.7 6.7 0 0 0 3.2-1.27c1.06.4 2.25.63 3.5.63 4.418 0 8-2.91 8-6.5S14.418 2 10 2Z"
            clipRule="evenodd"
          />
        </svg>
        {count > 0 ? count : 'Add'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-900">Comments</h2>
                <p className="truncate text-xs text-zinc-400">{email}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Thread */}
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No comments yet. Add the first one below.</p>
              ) : (
                items.map((c) => {
                  const canDelete = isAdmin || c.author_id === currentUserId
                  return (
                    <div key={c.id} className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-700">{c.author_name || 'Someone'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">{fmtTime(c.created_at)}</span>
                          {canDelete && (
                            <button
                              onClick={() => remove(c.id)}
                              disabled={pending}
                              className="text-[10px] text-zinc-400 hover:text-red-500 disabled:opacity-40"
                              title="Delete comment"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-zinc-700">{c.body}</p>
                    </div>
                  )
                })
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-zinc-100 px-5 py-3">
              {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Cmd/Ctrl+Enter submits.
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
                rows={3}
                placeholder="Add a comment… e.g. struggled to sign in to SensAI for xyz reason"
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">⌘/Ctrl + Enter to post</span>
                <button
                  onClick={submit}
                  disabled={pending || !draft.trim()}
                  className="rounded-lg bg-[#5BAE5B] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4e9d4e] disabled:opacity-40"
                >
                  {pending ? 'Saving…' : 'Add comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
