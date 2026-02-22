'use client'

import { useTransition } from 'react'
import { createRole, updateRole } from '@/app/(protected)/placements/actions'
import type { Role } from '@/types'

interface Props {
  role?: Role
  companyId: string
  onClose: () => void
}

export default function RoleForm({ role, companyId, onClose }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (role) {
        await updateRole(role.id, formData)
      } else {
        await createRole(formData)
      }
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="company_id" value={companyId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Role title</label>
        <input
          name="role_title"
          defaultValue={role?.role_title ?? ''}
          required
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="e.g. Frontend Developer"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Location</label>
        <input
          name="location"
          defaultValue={role?.location ?? ''}
          required
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="e.g. Chennai or Remote"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          Salary range <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          name="salary_range"
          defaultValue={role?.salary_range ?? ''}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="e.g. ₹4–6 LPA"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Job description</label>
        <textarea
          name="job_description"
          defaultValue={role?.job_description ?? ''}
          required
          rows={4}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          placeholder="Describe the role, responsibilities, requirements..."
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
          {isPending ? 'Saving…' : role ? 'Save changes' : 'Add role'}
        </button>
      </div>
    </form>
  )
}
