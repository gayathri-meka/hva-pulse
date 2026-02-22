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

type FilterKey = 'all' | 'shortlisted' | 'rejected' | 'hired'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:         'All',
  shortlisted: 'In Process',
  rejected:    'Rejected',
  hired:       'Hired',
}

const STATUS_BADGE: Record<string, string> = {
  applied:     'bg-blue-100 text-blue-700',
  shortlisted: 'bg-amber-100 text-amber-700',
  rejected:    'bg-red-100 text-red-700',
  hired:       'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<string, string> = {
  applied:     'Applied',
  shortlisted: 'In Process',
  rejected:    'Rejected',
  hired:       'Hired',
}

export default function MyRolesList({ applications }: { applications: ApplicationRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered =
    filter === 'all'
      ? applications
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
          <Link key={app.id} href={`/learner/roles/${app.role_id}`} className="block">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-400">{app.company_name}</p>
                  <h3 className="mt-0.5 truncate text-sm font-semibold text-zinc-900">
                    {app.role_title}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {app.location}
                    {app.salary_range ? ` · ${app.salary_range}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_BADGE[app.status] ?? 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Applied {new Date(app.created_at).toLocaleDateString('en-GB')}
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
