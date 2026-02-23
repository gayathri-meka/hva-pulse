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

  const inputCls = 'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900'

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <input type="hidden" name="company_id" value={companyId} />

      {/* Two-column body: short fields left, JD right */}
      <div className="flex flex-1 gap-6 overflow-hidden p-1">
        {/* Left column */}
        <div className="w-64 shrink-0 space-y-4 overflow-y-auto py-1 pr-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Role title</label>
            <input
              name="role_title"
              defaultValue={role?.role_title ?? ''}
              required
              className={inputCls}
              placeholder="e.g. Frontend Developer"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Location</label>
            <input
              name="location"
              defaultValue={role?.location ?? ''}
              required
              className={inputCls}
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
              className={inputCls}
              placeholder="e.g. ₹4–6 LPA"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">
              JD attachment <span className="text-zinc-400">(optional)</span>
            </label>
            {role?.jd_attachment_url && (
              <a
                href={role.jd_attachment_url}
                target="_blank"
                rel="noreferrer"
                className="mb-2 flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.414A2 2 0 0 0 13.414 5L11 2.586A2 2 0 0 0 9.586 2H4Zm5 1.5v2A1.5 1.5 0 0 0 10.5 7H13v5a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 12V4a.5.5 0 0 1 .5-.5h5Z" clipRule="evenodd" />
                </svg>
                Current attachment
              </a>
            )}
            <input
              type="file"
              name="jd_attachment"
              accept=".pdf,.doc,.docx"
              className="w-full text-xs text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
            />
          </div>
        </div>

        {/* Right column — JD fills remaining height */}
        <div className="flex flex-1 flex-col">
          <label className="mb-1 block text-xs font-medium text-zinc-700">Job description</label>
          <textarea
            name="job_description"
            defaultValue={role?.job_description ?? ''}
            required
            className="min-h-0 flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
            placeholder="Describe the role, responsibilities, requirements..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-zinc-100 pt-4">
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
