'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const Chevron = () => (
  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  </div>
)

const selectCls = 'appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'

interface Props {
  statuses: string[]
  batches:  string[]
  lfs:      string[]
  isLF:     boolean
  viewAll:  boolean
}

export default function LearnersFilters({ statuses, batches, lfs, isLF, viewAll }: Props) {
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
    params.delete('lf')
    router.push(`/learners?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <select
          value={searchParams.get('status') ?? ''}
          onChange={(e) => update('status', e.target.value)}
          className={selectCls}
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Chevron />
      </div>

      <div className="relative">
        <select
          value={searchParams.get('batch') ?? ''}
          onChange={(e) => update('batch', e.target.value)}
          className={selectCls}
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <Chevron />
      </div>

      <div className="relative">
        <select
          value={searchParams.get('lf') ?? ''}
          onChange={(e) => update('lf', e.target.value)}
          className={selectCls}
        >
          <option value="">All LFs</option>
          {lfs.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <Chevron />
      </div>

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
