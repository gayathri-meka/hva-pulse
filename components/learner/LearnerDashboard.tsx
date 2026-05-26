'use client'

import { useState } from 'react'
import Link from 'next/link'
import PlacementSnapshot from '@/components/learner/PlacementSnapshot'
import RoleCard from '@/components/learner/RoleCard'
import PlacedCelebration from '@/components/learner/PlacedCelebration'
import type { MyStatus } from '@/types'
import type { ReasonEntry } from '@/lib/snapshot'
import type { ApplyBlock } from '@/lib/learner/apply-eligibility'

type RoleItem = {
  id: string
  company_name: string
  role_title: string
  location: string
  salary_range: string | null
  status: 'open' | 'closed'
  my_status: MyStatus
  posted_at: string | null
  applied_at: string | null
  latest_activity_at: string | null
  not_shortlisted_reasons: string[]
  not_shortlisted_reason: string | null
  rejection_reasons: string[]
  rejection_feedback: string | null
  not_interested_reasons: string[]
}

type SnapshotData = {
  total: number
  applied: number
  notInterested: number
  ignored: number
  shortlisted: number
  interviewsOngoing: number
  onHold: number
  notShortlisted: number
  rejected: number
  hired: number
  pending: number
  applicationRate: number
  reasonCounts: Record<string, number>
}

type FilterKey =
  | 'all'
  | 'applied_any'
  | 'awaiting_shortlisting'
  | 'shortlisted'
  | 'interviews_ongoing'
  | 'on_hold'
  | 'not_shortlisted'
  | 'rejected'
  | 'hired'
  | 'not_interested'
  | 'ignored'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:                   'All',
  applied_any:           'Applied',
  awaiting_shortlisting: 'Awaiting shortlisting',
  shortlisted:           'Shortlisted',
  interviews_ongoing:    'Interviews Ongoing',
  on_hold:               'On Hold',
  not_shortlisted:       'Not Shortlisted',
  rejected:              'Rejected',
  hired:                 'Hired',
  not_interested:        'Not Interested',
  ignored:               'Ignored',
}

const FILTER_EXPLANATIONS: Record<FilterKey, string> = {
  all:                   'All roles brought by HVA',
  applied_any:           "Every role you've applied to, in any status",
  awaiting_shortlisting: 'Applied — waiting for HVA to shortlist',
  shortlisted:           'Shortlisted by HVA to move forward to company',
  interviews_ongoing:    'In the interview process',
  on_hold:               'Process paused by the company',
  not_shortlisted:       'HVA didn’t shortlist you to refer to the company',
  rejected:              'Decision made after the interview process',
  hired:                 'Companies that have made you an offer',
  not_interested:        "Roles you've marked as not interested",
  ignored:               'Roles you did not take a decision on',
}

// my_status values that mean an application exists
const APPLIED_STATUSES: ReadonlySet<MyStatus> = new Set<MyStatus>([
  'applied',
  'shortlisted',
  'interviews_ongoing',
  'on_hold',
  'not_shortlisted',
  'rejected',
  'hired',
])

type AppliedSort = 'most_active' | 'date_applied'

const APPLIED_SORT_LABELS: Record<AppliedSort, string> = {
  most_active:  'Most active first',
  date_applied: 'Date applied (newest)',
}

// Status priority for "Most active first": lower = appears higher in list.
const STATUS_PRIORITY: Partial<Record<MyStatus, number>> = {
  interviews_ongoing: 1,
  shortlisted:        2,
  applied:            3,
  on_hold:            4,
  hired:              5,
  not_shortlisted:    6,
  rejected:           7,
}

type Props = {
  firstName: string
  snapshot: SnapshotData
  ignoredOpenCount: number
  roles: RoleItem[]
  notShortlistedReasons: ReasonEntry[]
  rejectedReasons: ReasonEntry[]
  hasResume: boolean
  readOnly?: boolean
  blockReason?: ApplyBlock | null
}

export default function LearnerDashboard({ firstName, snapshot, ignoredOpenCount, roles, notShortlistedReasons, rejectedReasons, hasResume, readOnly = false, blockReason = null }: Props) {
  const isBlocked = blockReason !== null
  const isPlaced  = blockReason?.type === 'placed'
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [appliedSort, setAppliedSort] = useState<AppliedSort>('most_active')

  function handleViewIgnored() {
    setActiveFilter('ignored')
    document.getElementById('role-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function matchesFilter(role: RoleItem, key: FilterKey): boolean {
    if (key === 'all')                   return true
    if (key === 'ignored')               return role.my_status === 'not_applied'
    if (key === 'applied_any')           return APPLIED_STATUSES.has(role.my_status)
    if (key === 'awaiting_shortlisting') return role.my_status === 'applied'
    return role.my_status === key
  }

  const filteredRoles = (() => {
    const matched = roles.filter((r) => matchesFilter(r, activeFilter))

    // Applied superset keeps its own dropdown (status priority / date applied).
    // Every other filter sorts by most recent activity — the moment the row
    // last changed for the learner. Falls back to role posted date.
    if (activeFilter === 'applied_any') {
      const sorted = [...matched]
      if (appliedSort === 'most_active') {
        sorted.sort((a, b) => (STATUS_PRIORITY[a.my_status] ?? 99) - (STATUS_PRIORITY[b.my_status] ?? 99))
      } else if (appliedSort === 'date_applied') {
        sorted.sort((a, b) => (b.applied_at ?? '').localeCompare(a.applied_at ?? ''))
      }
      return sorted
    }

    return [...matched].sort((a, b) =>
      (b.latest_activity_at ?? '').localeCompare(a.latest_activity_at ?? ''),
    )
  })()

  // Only show filter pills that have matching roles (always show 'all')
  const visibleFilters = (Object.keys(FILTER_LABELS) as FilterKey[]).filter((key) => {
    if (key === 'all') return true
    return roles.some((r) => matchesFilter(r, key))
  })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Hey, {firstName}!</h1>
      </div>

      {isPlaced && <PlacedCelebration firstName={firstName} />}

      {isBlocked && !isPlaced && (
        <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3.5">
          <p className="text-sm font-semibold text-zinc-800">
            {blockReason!.message}.
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            Apply and Not Interested actions are disabled. If you believe this is a mistake, please reach out to your LF.
          </p>
        </div>
      )}

      {!hasResume && !isBlocked && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">You haven&apos;t uploaded a resume yet.</p>
            <p className="mt-0.5 text-xs text-amber-700">Upload one on your profile so you can start applying to companies.</p>
          </div>
          <Link
            href="/learner/profile"
            className="shrink-0 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-900"
          >
            Upload now
          </Link>
        </div>
      )}

      <PlacementSnapshot
        {...snapshot}
        ignoredOpenCount={ignoredOpenCount}
        onViewIgnored={handleViewIgnored}
        notShortlistedReasons={notShortlistedReasons}
        rejectedReasons={rejectedReasons}
      />

      {/* Filter pills */}
      <div id="role-list" className="-mx-1 mb-4 overflow-x-auto">
        <div className="flex min-w-max gap-2 px-1 pb-1">
          {visibleFilters.map((key) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === key
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation line — shows what the currently selected filter means.
          Hidden on All to keep the default view uncluttered.
          Sort dropdown only renders on the Applied (superset) filter. */}
      {activeFilter !== 'all' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">{FILTER_EXPLANATIONS[activeFilter]}</p>
          {activeFilter === 'applied_any' && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Sort:
              <span className="relative">
                <select
                  value={appliedSort}
                  onChange={(e) => setAppliedSort(e.target.value as AppliedSort)}
                  className="appearance-none rounded-md border border-zinc-200 bg-white py-1 pl-2.5 pr-7 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {(Object.keys(APPLIED_SORT_LABELS) as AppliedSort[]).map((key) => (
                    <option key={key} value={key}>{APPLIED_SORT_LABELS[key]}</option>
                  ))}
                </select>
                <svg
                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Role list — single column on narrow containers, 2-col on @lg, 3-col on @2xl.
          On the All view we surface open vs. closed because the learner is
          deciding where to apply; on every other filter we trust the activity
          sort and render in pure order so the most recent thing is on top. */}
      {(() => {
        if (activeFilter !== 'all') {
          return (
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
              {filteredRoles.map((role) => (
                <RoleCard key={role.id} role={role} readOnly={readOnly} blockReason={blockReason} />
              ))}
              {filteredRoles.length === 0 && (
                <div className="col-span-full rounded-xl border border-zinc-200 bg-white py-12 text-center">
                  <p className="text-sm text-zinc-400">No roles to show.</p>
                </div>
              )}
            </div>
          )
        }

        const openRoles   = filteredRoles.filter((r) => r.status === 'open')
        const closedRoles = filteredRoles.filter((r) => r.status === 'closed')
        const showDivider = openRoles.length > 0 && closedRoles.length > 0

        return (
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            {openRoles.map((role) => (
              <RoleCard key={role.id} role={role} readOnly={readOnly} blockReason={blockReason} />
            ))}

            {showDivider && (
              <div className="col-span-full flex items-center gap-3 py-2 text-xs font-medium text-zinc-400">
                <div className="h-px flex-1 bg-zinc-200" />
                <span>All roles below are closed for new applications</span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
            )}

            {closedRoles.map((role) => (
              <RoleCard key={role.id} role={role} readOnly={readOnly} blockReason={blockReason} />
            ))}

            {filteredRoles.length === 0 && (
              <div className="col-span-full rounded-xl border border-zinc-200 bg-white py-12 text-center">
                <p className="text-sm text-zinc-400">No roles to show.</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
