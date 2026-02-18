'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  statuses: string[]
  batches: string[]
}

export default function LearnersFilters({ statuses, batches }: Props) {
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

  return (
    <div className="flex gap-3">
      <select
        defaultValue={searchParams.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All Statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get('batch') ?? ''}
        onChange={(e) => update('batch', e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All Batches</option>
        {batches.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  )
}
