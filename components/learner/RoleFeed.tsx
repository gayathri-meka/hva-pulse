'use client'

import { useState } from 'react'
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

type Filter = 'open' | 'all'

export default function RoleFeed({ roles }: { roles: RoleItem[] }) {
  const [filter, setFilter] = useState<Filter>('open')

  const openCount = roles.filter((r) => r.status === 'open').length
  const allCount  = roles.length

  const displayed = filter === 'open' ? roles.filter((r) => r.status === 'open') : roles

  return (
    <div>
      {/* Toggle pills */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('open')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === 'open'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          All ({allCount})
        </button>
      </div>

      {/* Role list */}
      <div className="space-y-3">
        {displayed.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
        {displayed.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
            <p className="text-sm text-zinc-400">No roles available yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
