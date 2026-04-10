'use client'

import { useState } from 'react'

interface StageResult {
  avg: number | null
  n:   number
}

export type TatDetail = {
  learnerName: string
  companyName: string
  roleName:    string
  status:      string
  appliedAt:   string
  screenedAt:  string | null
  interviewAt: string | null
  outcomeAt:   string | null
}

interface Props {
  screening:             StageResult
  outcome:               StageResult
  rejectedTotal:         number
  rejectedWithInterview: number
  rejectedNoInterview:   number
  cutoffDate:            string
  details:               TatDetail[]
}

function fmt(days: number | null): string {
  if (days == null) return '—'
  return `${days}d`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const STATUS_BADGE: Record<string, string> = {
  applied:            'bg-blue-50 text-blue-700',
  shortlisted:        'bg-amber-50 text-amber-700',
  interviews_ongoing: 'bg-violet-50 text-violet-700',
  on_hold:            'bg-orange-50 text-orange-700',
  not_shortlisted:    'bg-zinc-100 text-zinc-600',
  rejected:           'bg-red-50 text-red-600',
  hired:              'bg-emerald-50 text-emerald-700',
}

const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied', shortlisted: 'Shortlisted', interviews_ongoing: 'Interviews',
  on_hold: 'On Hold', not_shortlisted: 'Not Shortlisted', rejected: 'Rejected', hired: 'Hired',
}

export default function TatDeepDive({
  screening,
  outcome,
  rejectedTotal,
  rejectedWithInterview,
  rejectedNoInterview,
  cutoffDate,
  details,
}: Props) {
  const [showPopup, setShowPopup] = useState(false)

  const stageSum = (screening.avg ?? 0) + (outcome.avg ?? 0)
  const pctScreening = stageSum > 0 && screening.avg != null ? Math.round((screening.avg / stageSum) * 100) : null
  const pctOutcome   = stageSum > 0 && outcome.avg != null   ? Math.round((outcome.avg / stageSum) * 100)   : null

  const noData = screening.n === 0 && outcome.n === 0

  return (
    <div className="mt-6 border-t border-zinc-100 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">TAT Deep Dive</h3>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Applications from {cutoffDate} onwards
          </p>
        </div>
        {!noData && (
          <button
            onClick={() => setShowPopup(true)}
            className="text-xs text-zinc-400 hover:text-zinc-700"
          >
            View all →
          </button>
        )}
      </div>

      {noData ? (
        <p className="py-4 text-center text-xs text-zinc-400">
          No data yet — statuses will be tracked from {cutoffDate}.
        </p>
      ) : (
        <>
          {/* Total TAT */}
          <div className="mb-4 flex items-baseline gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-3xl font-bold tabular-nums text-zinc-800">
              {screening.avg != null && outcome.avg != null ? `${screening.avg + outcome.avg}d` : fmt(screening.avg)}
            </p>
            <p className="text-sm font-semibold text-zinc-700">avg time to final outcome</p>
          </div>

          {/* Two stage cards — compact layout */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex items-baseline gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="text-2xl font-bold tabular-nums text-zinc-800">{fmt(screening.avg)}</p>
              <div>
                <p className="text-xs font-semibold text-zinc-600">Time to screening</p>
                <p className="text-[10px] text-zinc-400">HVA&apos;s control · n={screening.n}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
              <p className="text-2xl font-bold tabular-nums text-zinc-800">{fmt(outcome.avg)}</p>
              <div>
                <p className="text-xs font-semibold text-zinc-600">Screening → Outcome</p>
                <p className="text-[10px] text-zinc-400">Company&apos;s control · n={outcome.n}</p>
              </div>
            </div>
          </div>

          {/* Proportion bar */}
          {stageSum > 0 && (
            <div className="mb-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                {pctScreening != null && (
                  <div className="bg-blue-400 transition-all" style={{ width: `${pctScreening}%` }} />
                )}
                {pctOutcome != null && (
                  <div className="bg-amber-400 transition-all" style={{ width: `${pctOutcome}%` }} />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Screening {pctScreening != null ? `${pctScreening}%` : ''}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Final outcome {pctOutcome != null ? `${pctOutcome}%` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Rejection breakdown */}
          {rejectedTotal > 0 && (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{rejectedTotal}</span> rejected — <span className="font-medium text-zinc-700">{rejectedWithInterview}</span> got interviews, <span className="font-medium text-zinc-700">{rejectedNoInterview}</span> without
            </p>
          )}
        </>
      )}

      {/* Detail popup */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">TAT Breakdown</h2>
                <p className="text-xs text-zinc-400">{details.length} applications from {cutoffDate}</p>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Learner</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Company</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Applied</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Screened</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Interview</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {details
                    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
                    .map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-900">{d.learnerName}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600">{d.companyName}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-600">{d.roleName}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-zinc-500">{fmtDate(d.appliedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-zinc-500">{fmtDate(d.screenedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-zinc-500">{fmtDate(d.interviewAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-zinc-500">{fmtDate(d.outcomeAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
