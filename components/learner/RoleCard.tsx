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
  applied:        'bg-blue-100 text-blue-700',
  shortlisted:    'bg-amber-100 text-amber-700',
  rejected:       'bg-red-100 text-red-700',
  hired:          'bg-emerald-100 text-emerald-700',
  not_interested: 'bg-zinc-100 text-zinc-500',
}

const MY_STATUS_LABEL: Record<MyStatus, string> = {
  applied:        'Applied',
  shortlisted:    'In Process',
  rejected:       'Rejected',
  hired:          'Hired',
  not_interested: 'Not Interested',
  not_applied:    '',
}

export default function RoleCard({ role }: { role: RoleCardData }) {
  const [myStatus, setMyStatus] = useState<MyStatus>(role.my_status)
  const [isPending, startTransition] = useTransition()

  const canApply           = myStatus === 'not_applied' && role.status === 'open'
  const isNotInterested    = myStatus === 'not_interested'
  const showNIToggle       = myStatus === 'not_applied' || isNotInterested
  const canApplyAfterUndo  = isNotInterested && role.status === 'open'

  function handleNotInterested() {
    startTransition(async () => {
      if (isNotInterested) {
        await removeNotInterested(role.id)
        setMyStatus('not_applied')
      } else {
        await markNotInterested(role.id)
        setMyStatus('not_interested')
      }
    })
  }

  const statusBadgeClass = MY_STATUS_BADGE[myStatus]

  return (
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
                role.status === 'open'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-100 text-zinc-500'
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.615Z" />
                <path fillRule="evenodd" d="M9.75 17.25a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm.75-12.75a.75.75 0 0 0-1.5 0v.538a3.135 3.135 0 0 0-1.976 1.377c-.39.584-.574 1.257-.574 1.96 0 .974.38 1.818 1.07 2.395.543.455 1.215.736 1.98.893v2.633a2.515 2.515 0 0 1-.802-.418.75.75 0 0 0-.93 1.175A4.022 4.022 0 0 0 9 15.304v.446a.75.75 0 0 0 1.5 0v-.468a3.614 3.614 0 0 0 1.96-1.383c.404-.6.59-1.28.59-1.899 0-.962-.37-1.801-1.044-2.382-.524-.448-1.186-.733-1.956-.899V6.603c.247.064.471.17.682.324a.75.75 0 0 0 .878-1.217 3.18 3.18 0 0 0-1.06-.532V4.5Z" clipRule="evenodd" />
              </svg>
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
                onClick={handleNotInterested}
                disabled={isPending}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-40"
              >
                Undo
              </button>
            ) : (
              <button
                onClick={handleNotInterested}
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
          {(canApply || canApplyAfterUndo) && (
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
  )
}
