'use client'

import { useTransition } from 'react'
import { createCompany, updateCompany } from '@/app/(protected)/placements/actions'
import type { Company } from '@/types'

interface Props {
  company?: Company
  onClose: () => void
}

export default function CompanyForm({ company, onClose }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (company) {
        await updateCompany(company.id, formData)
      } else {
        await createCompany(formData)
      }
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Company name</label>
        <input
          name="company_name"
          defaultValue={company?.company_name ?? ''}
          required
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="e.g. Acme Corp"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : company ? 'Save changes' : 'Add company'}
        </button>
      </div>
    </form>
  )
}
