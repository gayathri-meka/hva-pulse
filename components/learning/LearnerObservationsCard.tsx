'use client'

import { useState } from 'react'
import ObservationsModal, { type Observation } from '@/components/learning/ObservationsModal'

interface Props {
  learnerId:       string
  learnerName:     string
  observations:    Observation[]
  currentUserId:   string
  currentUserName: string | null
  isAdmin:         boolean
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

export default function LearnerObservationsCard({
  learnerId,
  learnerName,
  observations,
  currentUserId,
  currentUserName,
  isAdmin,
}: Props) {
  const [open, setOpen] = useState(false)
  const recent = [...observations]
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, 5)

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Observations</h3>
          <div className="flex items-center gap-2">
            {observations.length > 5 && (
              <button
                onClick={() => setOpen(true)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
              >
                View all ({observations.length})
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
            >
              + Add observation
            </button>
          </div>
        </div>

        {recent.length === 0 ? (
          <p className="text-xs text-zinc-400">No observations yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((o) => (
              <li key={o.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                <div className="text-xs">
                  <span className="font-medium text-zinc-800">{fmtDate(o.observed_at)}</span>
                  <span className="text-zinc-400">{' · '}{o.author_name ?? 'Unknown'}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">{o.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <ObservationsModal
          learnerId={learnerId}
          learnerName={learnerName}
          observations={observations}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
