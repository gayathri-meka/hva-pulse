'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  applied:         'Applied',
  shortlisted:     'Shortlisted',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  hired:           'Hired',
  rejected:        'Rejected',
}

// Active pill colours per status
const STATUS_ACTIVE_CLASS: Record<string, string> = {
  applied:         'bg-blue-600 text-white',
  shortlisted:     'bg-amber-500 text-white',
  on_hold:         'bg-orange-500 text-white',
  not_shortlisted: 'bg-zinc-600 text-white',
  hired:           'bg-emerald-600 text-white',
  rejected:        'bg-red-600 text-white',
}

const STATUS_ORDER = ['applied', 'shortlisted', 'on_hold', 'not_shortlisted', 'hired', 'rejected']

interface Props {
  // Counts from the full (unfiltered-by-status) result set
  statusCounts: Record<string, number>
  total: number
}

export default function StatusFilter({ statusCounts, total }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()
  const current      = searchParams.get('status') ?? ''

  function pick(status: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (status) { params.set('status', status) } else { params.delete('status') }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => pick('')}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          !current
            ? 'bg-zinc-900 text-white'
            : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
        }`}
      >
        All ({total})
      </button>
      {STATUS_ORDER.map((s) => {
        const count = statusCounts[s] ?? 0
        if (!count) return null
        const isActive = current === s
        return (
          <button
            key={s}
            onClick={() => pick(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? (STATUS_ACTIVE_CLASS[s] ?? 'bg-zinc-900 text-white')
                : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {STATUS_LABELS[s]} ({count})
          </button>
        )
      })}
    </div>
  )
}
