'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { Company } from '@/types'

interface RoleOption {
  id: string
  company_id: string
  role_title: string
}

interface Props {
  companies: Company[]
  roles: RoleOption[]
}

export default function CompanyFilter({ companies, roles }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const selectedCompany = searchParams.get('company') ?? ''
  const selectedRole    = searchParams.get('role') ?? ''

  // Roles shown in the role dropdown — filtered by selected company if one is chosen
  const filteredRoles = selectedCompany
    ? roles.filter((r) => r.company_id === selectedCompany)
    : roles

  function handleCompanyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('role') // reset role when company changes
    if (e.target.value) {
      params.set('company', e.target.value)
    } else {
      params.delete('company')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('role', e.target.value)
    } else {
      params.delete('role')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Company dropdown */}
      <div className="relative">
        <select
          value={selectedCompany}
          onChange={handleCompanyChange}
          className="appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Role dropdown */}
      <div className="relative">
        <select
          value={selectedRole}
          onChange={handleRoleChange}
          className="appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
        >
          <option value="">All roles</option>
          {filteredRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.role_title}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  )
}
