'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  statuses: string[]
  batches: string[]
  isLF: boolean
  viewAll: boolean
}

export default function LearnersFilters({ statuses, batches, isLF, viewAll }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/learners?${params.toString()}`)
  }

  function toggleViewAll() {
    const params = new URLSearchParams(searchParams.toString())
    if (viewAll) {
      params.delete('viewAll')
    } else {
      params.set('viewAll', '1')
    }
    params.delete('status')
    params.delete('batch')
    router.push(`/learners?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        defaultValue={searchParams.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
      >
        <option value="">All Statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get('batch') ?? ''}
        onChange={(e) => update('batch', e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
      >
        <option value="">All Batches</option>
        {batches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      {isLF && (
        <button
          onClick={toggleViewAll}
          className={`rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
            viewAll
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
          }`}
        >
          {viewAll ? 'My Learners' : 'View All'}
        </button>
      )}
    </div>
  )
}
