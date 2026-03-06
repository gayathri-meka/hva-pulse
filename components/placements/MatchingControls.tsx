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

  const selectedRole    = searchParams.get('role')    ?? ''
  const selectedLearner = searchParams.get('learner') ?? ''

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    if (key === 'role') params.delete('status')
    router.push(`${pathname}?${params.toString()}`)
  }

  const roleOptions    = roles.map((r) => ({
    id:    r.id,
    label: `${r.company_name} — ${r.role_title}${r.status === 'closed' ? ' (closed)' : ''}`,
  }))
  const learnerOptions = learners.map((l) => ({ id: l.id, label: l.name || '(no name)' }))

  return (
    <div className="flex flex-wrap items-center gap-3">
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
    </div>
  )
}
