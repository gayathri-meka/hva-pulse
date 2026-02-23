'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { closeRole, reopenRole, deleteRole } from '@/app/(protected)/placements/actions'
import Modal from './Modal'
import RoleForm from './RoleForm'
import type { RoleWithCounts } from '@/types'

interface Props {
  role: RoleWithCounts
  companyName: string
}

export default function RoleRow({ role, companyName }: Props) {
  const [editOpen, setEditOpen]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition]  = useTransition()

  function handleClose() {
    startTransition(() => closeRole(role.id))
  }

  function handleReopen() {
    startTransition(() => reopenRole(role.id))
  }

  function handleDelete() {
    startTransition(() => deleteRole(role.id))
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
        {/* Top row: title + status + actions */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">{role.role_title}</p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
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

          {/* Stat chips + Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {role.applicant_count} applied
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {role.hired_count} hired
            </span>
            {role.not_interested_count > 0 && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                {role.not_interested_count} not interested
              </span>
            )}
            <div className="mx-1 h-4 w-px bg-zinc-200" />
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
              </svg>
              Edit
            </button>

            {role.status === 'open' ? (
              <button
                onClick={handleClose}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect x="3" y="7" width="10" height="8" rx="1" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
                </svg>
                Close role
              </button>
            ) : (
              <button
                onClick={handleReopen}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
              >
                Reopen
              </button>
            )}

            <Link
              href={`/placements/applications?role=${role.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Applications →
            </Link>

            {/* Delete role */}
            {confirmDelete ? (
              <>
                <span className="text-xs text-zinc-500">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-700"
                >
                  No
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                title="Delete role"
                className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Fullscreen edit modal */}
      {editOpen && (
        <Modal title={`Edit role — ${role.role_title}`} onClose={() => setEditOpen(false)} full>
          <RoleForm role={role} companyId={role.company_id} onClose={() => setEditOpen(false)} />
        </Modal>
      )}
    </>
  )
}
