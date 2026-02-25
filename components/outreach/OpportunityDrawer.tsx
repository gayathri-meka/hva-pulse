'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { JobOpportunityWithPersona } from '@/types'
import { updateOpportunityStatus, updateOpportunityNotes, deleteOpportunity } from '@/app/(protected)/outreach/opportunities/actions'

const STATUS_OPTIONS = ['discovered', 'reviewed', 'approved', 'rejected'] as const

const STATUS_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_BADGE: Record<string, string> = {
  discovered: 'bg-zinc-100 text-zinc-600',
  reviewed: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

type Props = {
  opportunity: JobOpportunityWithPersona
}

export default function OpportunityDrawer({ opportunity }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(opportunity.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('id')
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleStatusChange(status: string) {
    startTransition(() => updateOpportunityStatus(opportunity.id, status))
  }

  function handleNotesSave() {
    startTransition(() => updateOpportunityNotes(opportunity.id, notes))
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(async () => {
      await deleteOpportunity(opportunity.id)
      closeDrawer()
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={closeDrawer}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-zinc-900">{opportunity.job_title}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {opportunity.company_name}
              {opportunity.location && ` · ${opportunity.location}`}
            </p>
          </div>
          <button
            onClick={closeDrawer}
            className="ml-4 shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[opportunity.status]}`}>
              {STATUS_LABELS[opportunity.status]}
            </span>
            <span className="text-zinc-400">Source: {opportunity.source_platform}</span>
            {opportunity.date_posted && (
              <span className="text-zinc-400">
                Posted: {new Date(opportunity.date_posted).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {opportunity.persona_name && (
              <span className="text-zinc-400">Persona: {opportunity.persona_name}</span>
            )}
          </div>

          {/* Original URL */}
          {opportunity.original_url && (
            <a
              href={opportunity.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 underline-offset-2 hover:underline"
            >
              View Original Job Posting
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}

          {/* Match Reasoning */}
          {opportunity.match_reasoning && (
            <div className="rounded-md bg-zinc-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Match Reasoning</p>
              <p className="text-sm text-zinc-700">{opportunity.match_reasoning}</p>
            </div>
          )}

          {/* Job Description */}
          {opportunity.job_description && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Job Description</p>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">{opportunity.job_description}</p>
            </div>
          )}

          {/* Status Change */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isPending || opportunity.status === s}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    opportunity.status === s
                      ? STATUS_BADGE[s] + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              rows={3}
              placeholder="Add notes about this opportunity…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-zinc-200 px-6 py-4 flex justify-end">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={`text-sm font-medium transition-colors disabled:opacity-50 ${
              confirmDelete ? 'text-red-600 underline' : 'text-zinc-400 hover:text-red-600'
            }`}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}
