'use client'

import { useState } from 'react'
import PlacementSnapshot from '@/components/learner/PlacementSnapshot'
import RoleCard from '@/components/learner/RoleCard'
import type { MyStatus } from '@/types'

type RoleItem = {
  id: string
  company_name: string
  role_title: string
  location: string
  salary_range: string | null
  status: 'open' | 'closed'
  my_status: MyStatus
}

type SnapshotData = {
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
}

type FilterKey =
  | 'all'
  | 'applied'
  | 'shortlisted'
  | 'on_hold'
  | 'not_shortlisted'
  | 'rejected'
  | 'hired'
  | 'not_interested'
  | 'ignored'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:             'All',
  applied:         'Applied',
  shortlisted:     'In Process',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
  not_interested:  'Not Interested',
  ignored:         'Ignored',
}

type Props = {
  firstName: string
  snapshot: SnapshotData
  ignoredOpenCount: number
  roles: RoleItem[]
}

export default function LearnerDashboard({ firstName, snapshot, ignoredOpenCount, roles }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  function handleViewIgnored() {
    setActiveFilter('ignored')
    document.getElementById('role-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filteredRoles =
    activeFilter === 'all'
      ? roles
      : activeFilter === 'ignored'
        ? roles.filter((r) => r.my_status === 'not_applied')
        : roles.filter((r) => r.my_status === activeFilter)

  // Only show filter pills that have matching roles (always show 'all')
  const visibleFilters = (Object.keys(FILTER_LABELS) as FilterKey[]).filter((key) => {
    if (key === 'all') return true
    const count =
      key === 'ignored'
        ? roles.filter((r) => r.my_status === 'not_applied').length
        : roles.filter((r) => r.my_status === key).length
    return count > 0
  })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Hey, {firstName}!</h1>
      </div>

      <PlacementSnapshot
        {...snapshot}
        ignoredOpenCount={ignoredOpenCount}
        onViewIgnored={handleViewIgnored}
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

      {/* Role list */}
      <div className="space-y-3">
        {filteredRoles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
        {filteredRoles.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
            <p className="text-sm text-zinc-400">No roles to show.</p>
          </div>
        )}
      </div>
    </div>
  )
}
