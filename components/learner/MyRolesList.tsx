'use client'

import { useState } from 'react'
import Link from 'next/link'

type ApplicationRow = {
  id: string
  role_id: string
  status: string
  created_at: string
  role_title: string
  location: string
  salary_range: string | null
  company_name: string
}

type FilterKey = 'all' | 'shortlisted' | 'rejected' | 'hired' | 'not_interested'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:            'Applied',
  shortlisted:    'In Process',
  rejected:       'Rejected',
  hired:          'Hired',
  not_interested: 'Not Interested',
}

const STATUS_BADGE: Record<string, string> = {
  applied:        'bg-blue-100 text-blue-700',
  shortlisted:    'bg-amber-100 text-amber-700',
  rejected:       'bg-red-100 text-red-700',
  hired:          'bg-emerald-100 text-emerald-700',
  not_interested: 'bg-zinc-100 text-zinc-500',
}

const STATUS_LABEL: Record<string, string> = {
  applied:        'Applied',
  shortlisted:    'In Process',
  rejected:       'Rejected',
  hired:          'Hired',
  not_interested: 'Not Interested',
}

export default function MyRolesList({ applications }: { applications: ApplicationRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  // 'all' shows applied/shortlisted/rejected/hired (excludes not_interested)
  const filtered =
    filter === 'all'
      ? applications.filter((a) => a.status !== 'not_interested')
      : applications.filter((a) => a.status === filter)

  return (
    <div>
      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Application cards */}
      <div className="space-y-3">
        {filtered.map((app) => (
          <Link
            key={app.id}
            href={`/learner/roles/${app.role_id}`}
            className="block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold leading-snug text-zinc-900">
                    {app.company_name}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {app.role_title}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    STATUS_BADGE[app.status] ?? 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                  </svg>
                  {app.location}
                </span>

                {app.salary_range && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                    <span className="shrink-0 font-medium text-zinc-400">₹</span>
                    {app.salary_range}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-100 px-4 py-2">
              <p className="text-xs text-zinc-400">
                {app.status === 'not_interested' ? 'Marked' : 'Applied'}{' '}
                {new Date(app.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
            <p className="text-sm text-zinc-400">No applications found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
