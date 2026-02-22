'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import type { Company } from '@/types'

interface Props {
  companies: Company[]
}

export default function CompanyFilter({ companies }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const selected = searchParams.get('company') ?? ''

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    // Clear role param when switching company filter
    params.delete('role')
    if (e.target.value) {
      params.set('company', e.target.value)
    } else {
      params.delete('company')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
    >
      <option value="">All companies</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.company_name}
        </option>
      ))}
    </select>
  )
}
