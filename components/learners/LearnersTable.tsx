'use client'

import { useColumnResize } from '@/hooks/useColumnResize'

const STATUS_BADGE: Record<string, string> = {
  Ongoing: 'bg-emerald-100 text-emerald-700',
  Dropout: 'bg-red-100 text-red-700',
  Discontinued: 'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA': 'bg-violet-100 text-violet-700',
}

type LearnerRow = {
  learner_id: string
  name: string
  email: string
  batch_name: string
  status: string
  lf_name: string
  track: string
  join_date: string | null
}

// Initial column widths: Name, Email, Batch, Status, LF, Track, Joined
const INIT_WIDTHS = [200, 240, 140, 130, 160, 140, 110]

export default function LearnersTable({ learners }: { learners: LearnerRow[] }) {
  const { widths, onResizeStart } = useColumnResize(INIT_WIDTHS)

  const headers = ['Name', 'Email', 'Batch', 'Status', 'LF', 'Track', 'Joined']

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-sm"
          style={{ tableLayout: 'fixed', width: widths.reduce((a, b) => a + b, 0) }}
        >
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              {headers.map((label, i) => (
                <th
                  key={i}
                  className="relative px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 select-none"
                  style={{ width: widths[i] }}
                >
                  {label}
                  {i < headers.length - 1 && (
                    <div
                      onMouseDown={(e) => onResizeStart(i, e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-zinc-300"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {learners.map((learner) => (
              <tr key={learner.learner_id} className="hover:bg-zinc-50">
                <td className="truncate px-6 py-3.5 font-medium text-zinc-900">{learner.name}</td>
                <td className="truncate px-6 py-3.5 text-zinc-400">{learner.email}</td>
                <td className="truncate px-6 py-3.5 text-zinc-600">{learner.batch_name}</td>
                <td className="px-6 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {learner.status}
                  </span>
                </td>
                <td className="truncate px-6 py-3.5 text-zinc-600">{learner.lf_name}</td>
                <td className="truncate px-6 py-3.5 text-zinc-600">{learner.track}</td>
                <td className="px-6 py-3.5 text-zinc-400">{learner.join_date ?? '—'}</td>
              </tr>
            ))}
            {learners.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-400">
                  No learners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
