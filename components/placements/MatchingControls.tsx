'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Combobox from '@/components/ui/Combobox'

export interface RoleOption {
  id:           string
  role_title:   string
  company_name: string
  status:       string
}

interface Props {
  roles:    RoleOption[]
  learners: { id: string; name: string }[]
}

export default function MatchingControls({ roles, learners }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const mode            = searchParams.get('mode') ?? 'matching'
  const selectedRole    = searchParams.get('role')    ?? ''
  const selectedLearner = searchParams.get('learner') ?? ''

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    if (key === 'role') params.delete('status')
    router.push(`${pathname}?${params.toString()}`)
  }

  function switchMode(newMode: string) {
    router.push(newMode === 'matching' ? pathname : `${pathname}?mode=${newMode}`)
  }

  const roleOptions    = roles.map((r) => ({
    id:    r.id,
    label: `${r.company_name} — ${r.role_title}${r.status === 'closed' ? ' (closed)' : ''}`,
  }))
  const learnerOptions = learners.map((l) => ({ id: l.id, label: l.name || '(no name)' }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => switchMode('matching')}
          className={`rounded px-3 py-1 transition-colors ${
            mode === 'matching' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          By Role
        </button>
        <button
          type="button"
          onClick={() => switchMode('not_interested')}
          className={`rounded px-3 py-1 transition-colors ${
            mode === 'not_interested' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Not Interested
        </button>
      </div>

      {/* Role + learner selectors — only in matching mode */}
      {mode === 'matching' && (
        <>
          <Combobox
            options={roleOptions}
            value={selectedRole}
            placeholder="All roles"
            onChange={(id) => navigate('role', id)}
            className="min-w-[260px] font-medium"
          />
          <Combobox
            options={learnerOptions}
            value={selectedLearner}
            placeholder="All learners"
            onChange={(id) => navigate('learner', id)}
            className="min-w-[180px]"
          />
        </>
      )}
    </div>
  )
}
