'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Combobox from '@/components/ui/Combobox'
import type { Company } from '@/types'

interface RoleOption {
  id:         string
  company_id: string
  role_title: string
}

interface LearnerOption {
  id:    string
  name:  string
  email: string
}

interface Props {
  companies: Company[]
  roles:     RoleOption[]
  learners:  LearnerOption[]
}

export default function CompanyFilter({ companies, roles, learners }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const selectedCompany = searchParams.get('company') ?? ''
  const selectedRole    = searchParams.get('role')    ?? ''
  const selectedLearner = searchParams.get('learner') ?? ''

  // Roles shown in the role combobox — filtered by selected company
  const filteredRoles = selectedCompany
    ? roles.filter((r) => r.company_id === selectedCompany)
    : roles

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val)
      else params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const companyOptions = companies.map((c) => ({ id: c.id, label: c.company_name }))
  const roleOptions    = filteredRoles.map((r) => ({ id: r.id, label: r.role_title }))
  const learnerOptions = learners.map((l) => ({
    id:    l.id,
    label: l.name || l.email,
  }))

  return (
    <div className="flex flex-wrap gap-2">
      {/* Company combobox */}
      <Combobox
        options={companyOptions}
        value={selectedCompany}
        placeholder="All companies"
        onChange={(id) => navigate({ company: id, role: '' })}
        className="min-w-[180px]"
      />

      {/* Role combobox — only shown when a company is selected */}
      {selectedCompany && (
        <Combobox
          options={roleOptions}
          value={selectedRole}
          placeholder="All roles"
          onChange={(id) => navigate({ role: id })}
          className="min-w-[160px]"
        />
      )}

      {/* Learner combobox */}
      <Combobox
        options={learnerOptions}
        value={selectedLearner}
        placeholder="All learners"
        onChange={(id) => navigate({ learner: id })}
        className="min-w-[180px]"
      />
    </div>
  )
}
