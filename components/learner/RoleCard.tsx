'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { markNotInterested, removeNotInterested } from '@/app/(learner)/learner/actions'
import type { MyStatus } from '@/types'

type RoleCardData = {
  id: string
  company_name: string
  role_title: string
  location: string
  salary_range: string | null
  status: 'open' | 'closed'
  my_status: MyStatus
}

const MY_STATUS_BADGE: Partial<Record<MyStatus, string>> = {
  applied:         'bg-blue-100 text-blue-700',
  shortlisted:     'bg-amber-100 text-amber-700',
  on_hold:         'bg-orange-100 text-orange-700',
  not_shortlisted: 'bg-zinc-100 text-zinc-600',
  rejected:        'bg-red-100 text-red-700',
  hired:           'bg-emerald-100 text-emerald-700',
  not_interested:  'bg-zinc-100 text-zinc-500',
}

const MY_STATUS_LABEL: Record<MyStatus, string> = {
  applied:         'Applied',
  shortlisted:     'In Process',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
  not_interested:  'Not Interested',
  not_applied:     '',
}

const NI_REASONS = [
  'Location Mismatch',
  'Stipend/Compensation Low',
  'Not available on the Interview dates',
  'Skill Mismatch',
  'Unable to travel for Interview',
  'Not Eligible',
  'Others',
]

function NIReasonsModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reasons: string[]) => void
  onCancel:  () => void
  isPending: boolean
}) {
  const [checked, setChecked]   = useState<Set<string>>(new Set())
  const [otherText, setOtherText] = useState('')

  function toggle(reason: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(reason) ? next.delete(reason) : next.add(reason)
      return next
    })
  }

  function handleConfirm() {
    const reasons = Array.from(checked).filter((r) => r !== 'Others')
    if (checked.has('Others') && otherText.trim()) {
      reasons.push(otherText.trim())
    }
    onConfirm(reasons)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-base font-semibold text-zinc-900">
          Why aren&apos;t you interested?
        </h3>

        <div className="space-y-2.5">
          {NI_REASONS.map((reason) => (
            <label key={reason} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checked.has(reason)}
                onChange={() => toggle(reason)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900"
              />
              <span className="text-sm text-zinc-700">{reason}</span>
            </label>
          ))}
        </div>

        {checked.has('Others') && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Please describe…"
            className="mt-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoleCard({ role }: { role: RoleCardData }) {
  const [myStatus, setMyStatus]     = useState<MyStatus>(role.my_status)
  const [showNIModal, setShowNIModal] = useState(false)
  const [isPending, startTransition]  = useTransition()

  const canApply        = myStatus === 'not_applied' && role.status === 'open'
  const isNotInterested = myStatus === 'not_interested'
  const showNIToggle    = myStatus === 'not_applied' || isNotInterested

  function handleNIConfirm(reasons: string[]) {
    startTransition(async () => {
      await markNotInterested(role.id, reasons)
      setMyStatus('not_interested')
      setShowNIModal(false)
    })
  }

  function handleUndo() {
    startTransition(async () => {
      await removeNotInterested(role.id)
      setMyStatus('not_applied')
    })
  }

  const statusBadgeClass = MY_STATUS_BADGE[myStatus]

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Card body — entire body is a link to role detail */}
        <Link href={`/learner/roles/${role.id}`} className="block p-4">
          {/* Top row: company + status badges */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold leading-snug text-zinc-900">
                {role.company_name}
              </p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {role.role_title}
              </p>
            </div>

            {/* Right: role status + my status stacked */}
            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  role.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {role.status === 'open' ? 'Open' : 'Closed'}
              </span>
              {statusBadgeClass && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass}`}>
                  {MY_STATUS_LABEL[myStatus]}
                </span>
              )}
            </div>
          </div>

          {/* Location + Salary */}
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
              </svg>
              {role.location}
            </span>

            {role.salary_range && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                <span className="shrink-0 font-medium text-zinc-400">₹</span>
                {role.salary_range}
              </span>
            )}
          </div>
        </Link>

        {/* Action bar — outside the link to avoid nested interactive elements */}
        <div className="flex items-center justify-end border-t border-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {/* Not Interested / Undo */}
            {showNIToggle && (
              isNotInterested ? (
                <button
                  onClick={handleUndo}
                  disabled={isPending}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-40"
                >
                  Undo
                </button>
              ) : (
                <button
                  onClick={() => setShowNIModal(true)}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100 disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                  Not Interested
                </button>
              )
            )}

            {/* Apply */}
            {canApply && (
              <Link
                href={`/learner/roles/${role.id}`}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
              >
                Apply →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* NI Reasons Modal */}
      {showNIModal && (
        <NIReasonsModal
          onConfirm={handleNIConfirm}
          onCancel={() => setShowNIModal(false)}
          isPending={isPending}
        />
      )}
    </>
  )
}
