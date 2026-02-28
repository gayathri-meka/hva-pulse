'use client'

import { useState } from 'react'

type Props = {
  total: number
  applied: number
  notInterested: number
  ignored: number
  shortlisted: number
  onHold: number
  notShortlisted: number
  rejected: number
  hired: number
  pending: number
  applicationRate: number
  reasonCounts: Record<string, number>
  ignoredOpenCount: number
  onViewIgnored: () => void
}

export default function PlacementSnapshot({
  total,
  applied,
  notInterested,
  ignored,
  shortlisted,
  onHold,
  notShortlisted,
  rejected,
  hired,
  pending,
  applicationRate,
  reasonCounts,
  ignoredOpenCount,
  onViewIgnored,
}: Props) {
  const [reasonsOpen, setReasonsOpen] = useState(false)
  const reasonEntries = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])
  const hasReasons = notInterested > 0 && reasonEntries.length > 0

  return (
    <div className="mb-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your Placement Snapshot
        </h2>

        {/* Total */}
        <p className="mb-4 text-2xl font-bold text-zinc-900">
          {total}{' '}
          <span className="text-base font-normal text-zinc-500">
            total opportunit{total === 1 ? 'y' : 'ies'}
          </span>
        </p>

        {/* Row 1: Applied / Not Interested / Ignored */}
        <div className="mb-1 grid grid-cols-3 gap-3">
          <StatBox label="Applied" value={applied} />

          {/* Not Interested — with optional expand */}
          <div className="rounded-lg bg-zinc-50 p-3">
            <div className="flex items-start justify-between gap-1">
              <p className="text-xl font-bold text-zinc-900">{notInterested}</p>
              {hasReasons && (
                <button
                  onClick={() => setReasonsOpen((o) => !o)}
                  className="mt-0.5 text-zinc-400 transition-colors hover:text-zinc-600"
                  aria-label={reasonsOpen ? 'Hide reasons' : 'Show reasons breakdown'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 transition-transform ${reasonsOpen ? 'rotate-180' : ''}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">Not Interested</p>

            {reasonsOpen && (
              <div className="mt-2 space-y-1.5 border-t border-zinc-200 pt-2">
                {reasonEntries.map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-600">{reason}</span>
                    <span className="text-xs font-semibold text-zinc-900">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <StatBox
            label="Ignored"
            value={ignored}
            valueClass={ignored > 0 ? 'text-amber-600' : undefined}
          />
        </div>

        {/* Application rate */}
        <p className="mb-4 mt-3 text-sm text-zinc-500">
          You have applied to{' '}
          <span className="font-semibold text-zinc-900">{applicationRate}%</span> of roles
          shared with you.
        </p>

        {/* Applications breakdown — only if they have applied */}
        {applied > 0 && (
          <>
            <div className="mb-3 border-t border-zinc-100" />
            <p className="mb-2.5 text-xs font-medium text-zinc-400">
              Of your {applied} application{applied !== 1 ? 's' : ''}:
            </p>
            <div className="flex flex-wrap gap-4">
              {pending > 0 && (
                <MiniStat label="Awaiting outcome" value={pending} valueClass="text-blue-600" />
              )}
              {shortlisted > 0 && (
                <MiniStat label="In Process" value={shortlisted} valueClass="text-amber-600" />
              )}
              {onHold > 0 && (
                <MiniStat label="On Hold" value={onHold} valueClass="text-orange-600" />
              )}
              {notShortlisted > 0 && (
                <MiniStat label="Not Shortlisted" value={notShortlisted} valueClass="text-zinc-600" />
              )}
              {rejected > 0 && (
                <MiniStat label="Rejected" value={rejected} valueClass="text-red-600" />
              )}
              {hired > 0 && (
                <MiniStat label="Hired" value={hired} valueClass="text-emerald-600" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Callout: open roles with no decision */}
      {ignoredOpenCount > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            {ignoredOpenCount} open {ignoredOpenCount === 1 ? 'role' : 'roles'} without a
            decision from you.
          </p>
          <button
            onClick={onViewIgnored}
            className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-900"
          >
            View them
          </button>
        </div>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
  valueClass,
}: {
  label: string
  value: number
  valueClass?: string
}) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className={`text-xl font-bold ${valueClass ?? 'text-zinc-900'}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  )
}

function MiniStat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: number
  valueClass: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}
