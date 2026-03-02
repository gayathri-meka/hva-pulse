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
  roles:   RoleOption[]
  batches: string[]
  lfs:     string[]
}

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

  const roleOptions = roles.map((r) => ({
    id:    r.id,
    label: `${r.company_name} — ${r.role_title}${r.status === 'closed' ? ' (closed)' : ''}`,
  }))

  const batchOptions = batches.map((b) => ({ id: b, label: b }))
  const lfOptions    = lfs.map((l)    => ({ id: l, label: l }))

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Combobox
        options={roleOptions}
        value={selectedRole}
        placeholder="Select a role…"
        onChange={(id) => navigate('role', id)}
        className="min-w-[260px] font-medium"
      />
      <Combobox
        options={batchOptions}
        value={selectedBatch}
        placeholder="All batches"
        onChange={(id) => navigate('batch', id)}
        className="min-w-[140px]"
      />
      <Combobox
        options={lfOptions}
        value={selectedLf}
        placeholder="All LFs"
        onChange={(id) => navigate('lf', id)}
        className="min-w-[140px]"
      />
    </div>
  )
}
