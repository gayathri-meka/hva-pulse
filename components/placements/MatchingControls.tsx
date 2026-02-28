'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export interface RoleOption {
  id:           string
  role_title:   string
  company_name: string
  status:       string
}

interface Props {
  roles:   RoleOption[]
  batches: string[]
  lfs:     string[]
}

const Chevron = () => (
  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  </div>
)

const selectCls = 'appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900'

export default function MatchingControls({ roles, batches, lfs }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const selectedRole  = searchParams.get('role')  ?? ''
  const selectedBatch = searchParams.get('batch') ?? ''
  const selectedLf    = searchParams.get('lf')    ?? ''

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    // Changing the role resets the status filter (counts belong to that role)
    if (key === 'role') params.delete('status')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Role — required */}
      <div className="relative">
        <select
          value={selectedRole}
          onChange={(e) => navigate('role', e.target.value)}
          className={`${selectCls} min-w-[260px] font-medium`}
        >
          <option value="">Select a role…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.company_name} — {r.role_title}{r.status === 'closed' ? ' (closed)' : ''}
            </option>
          ))}
        </select>
        <Chevron />
      </div>

      {/* Batch — optional */}
      <div className="relative">
        <select
          value={selectedBatch}
          onChange={(e) => navigate('batch', e.target.value)}
          className={selectCls}
        >
          <option value="">All batches</option>
          {batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <Chevron />
      </div>

      {/* LF — optional */}
      <div className="relative">
        <select
          value={selectedLf}
          onChange={(e) => navigate('lf', e.target.value)}
          className={selectCls}
        >
          <option value="">All LFs</option>
          {lfs.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <Chevron />
      </div>
    </div>
  )
}
