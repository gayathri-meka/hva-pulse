'use client'

import { useState, useTransition } from 'react'
import { updateApplicationStatus } from '@/app/(protected)/placements/actions'
import ExportButton from './ExportButton'
import type { ApplicationWithLearner } from '@/types'

const STATUS_OPTIONS = ['applied', 'shortlisted', 'rejected', 'hired'] as const
const STATUS_BADGE: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  hired: 'bg-emerald-100 text-emerald-700',
}

interface Props {
  applications: ApplicationWithLearner[]
}

export default function ApplicationsList({ applications }: Props) {
  const [statusMap, setStatusMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(applications.map((a) => [a.id, a.status]))
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const allChecked = applications.length > 0 && applications.every((a) => selected.has(a.id))

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(applications.map((a) => a.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleStatusChange(id: string, newStatus: string) {
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }))
    startTransition(() => updateApplicationStatus(id, newStatus))
  }

  const selectedApplications = applications.filter((a) => selected.has(a.id))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {applications.length} application{applications.length !== 1 ? 's' : ''}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>
        <ExportButton applications={selectedApplications} disabled={selected.size === 0} />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Learner
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Company / Role
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Location
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Resume
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Applied
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {applications.map((app) => {
                const currentStatus = statusMap[app.id] ?? app.status
                return (
                  <tr key={app.id} className={selected.has(app.id) ? 'bg-zinc-50' : 'hover:bg-zinc-50'}>
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(app.id)}
                        onChange={() => toggleOne(app.id)}
                        className="rounded border-zinc-300"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-zinc-900">{app.learner_name}</p>
                      <p className="text-xs text-zinc-400">{app.learner_email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-zinc-900">{app.company_name}</p>
                      <p className="text-xs text-zinc-400">{app.role_title}</p>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 text-xs">{app.location}</td>
                    <td className="px-4 py-3.5">
                      {app.resume_url ? (
                        <a
                          href={app.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#5BAE5B] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 ${
                          STATUS_BADGE[currentStatus] ?? 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
