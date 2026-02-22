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
  not_applied:    'Not Applied',
}

export default function RoleCard({ role }: { role: RoleCardData }) {
  const [myStatus, setMyStatus] = useState<MyStatus>(role.my_status)
  const [isPending, startTransition] = useTransition()

  const canApply = myStatus === 'not_applied' && role.status === 'open'
  const isNotInterested = myStatus === 'not_interested'
  const showNotInterestedToggle = myStatus === 'not_applied' || isNotInterested

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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-400">{role.company_name}</p>
          <h2 className="mt-0.5 truncate text-base font-semibold text-zinc-900">
            {role.role_title}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {role.location}
            {role.salary_range ? ` · ${role.salary_range}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              role.status === 'open'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {role.status === 'open' ? 'Open' : 'Closed'}
          </span>
          {MY_STATUS_BADGE[myStatus] && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MY_STATUS_BADGE[myStatus]}`}
            >
              {MY_STATUS_LABEL[myStatus]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/learner/roles/${role.id}`}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          View Details
        </Link>

        {canApply && (
          <Link
            href={`/learner/roles/${role.id}?tab=apply`}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Apply
          </Link>
        )}

        {showNotInterestedToggle && (
          <button
            onClick={handleNotInterested}
            disabled={isPending}
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-40"
          >
            {isNotInterested ? 'Undo' : 'Not Interested'}
          </button>
        )}
      </div>
    </div>
  )
}
