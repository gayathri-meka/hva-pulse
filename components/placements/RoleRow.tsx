'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { closeRole } from '@/app/(protected)/placements/actions'
import Modal from './Modal'
import RoleForm from './RoleForm'
import type { RoleWithCounts } from '@/types'

interface Props {
  role: RoleWithCounts
  companyName: string
}

export default function RoleRow({ role, companyName }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleClose() {
    startTransition(() => closeRole(role.id))
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
        {/* Left: role info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900 text-sm truncate">{role.role_title}</p>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                role.status === 'open'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-zinc-200 text-zinc-500'
              }`}
            >
              {role.status === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            {role.location}
            {role.salary_range && ` · ${role.salary_range}`}
          </p>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-zinc-500">{role.applicant_count} applicant{role.applicant_count !== 1 ? 's' : ''}</span>
          <span className="font-medium text-[#5BAE5B]">{role.hired_count} hired</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            title="Edit role"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
            </svg>
          </button>

          {role.status === 'open' && (
            <button
              onClick={handleClose}
              disabled={isPending}
              title="Close role"
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="7" width="10" height="8" rx="1" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <Link
            href={`/placements/applications?role=${role.id}`}
            className="ml-1 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
          >
            Applications →
          </Link>
        </div>
      </div>

      {editOpen && (
        <Modal title="Edit role" onClose={() => setEditOpen(false)}>
          <RoleForm role={role} companyId={role.company_id} onClose={() => setEditOpen(false)} />
        </Modal>
      )}
    </>
  )
}
