'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { closeRole, reopenRole, updateJobDescription } from '@/app/(protected)/placements/actions'
import Modal from './Modal'
import RoleForm from './RoleForm'
import type { RoleWithCounts } from '@/types'

interface Props {
  role: RoleWithCounts
  companyName: string
}

export default function RoleRow({ role, companyName }: Props) {
  const [editOpen, setEditOpen]   = useState(false)
  const [jdOpen, setJdOpen]       = useState(false)
  const [jdText, setJdText]       = useState(role.job_description)
  const [isPending, startTransition]     = useTransition()
  const [isJdPending, startJdTransition] = useTransition()

  function handleClose() {
    startTransition(() => closeRole(role.id))
  }

  function handleReopen() {
    startTransition(() => reopenRole(role.id))
  }

  function handleSaveJD() {
    startJdTransition(async () => {
      await updateJobDescription(role.id, jdText)
      setJdOpen(false)
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
        {/* Left: role info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-900">{role.role_title}</p>
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
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <span className="text-zinc-500">{role.applicant_count} applicant{role.applicant_count !== 1 ? 's' : ''}</span>
          <span className="font-medium text-[#5BAE5B]">{role.hired_count} hired</span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Edit */}
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
            </svg>
            Edit
          </button>

          {/* View / Edit JD */}
          <button
            onClick={() => setJdOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
              <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
            </svg>
            View JD
          </button>

          {/* Close / Reopen */}
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3 w-3">
                <rect x="3" y="7" width="10" height="8" rx="1" />
                <path d="M5 7V5a3 3 0 0 1 6 0" strokeLinecap="round" />
                <path d="M11 3.5 13 1.5" strokeLinecap="round" />
              </svg>
              Reopen
            </button>
          )}

          {/* Applications link */}
          <Link
            href={`/placements/applications?role=${role.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Applications →
          </Link>
        </div>
      </div>

      {/* Edit role modal */}
      {editOpen && (
        <Modal title={`Edit role — ${role.role_title}`} onClose={() => setEditOpen(false)}>
          <RoleForm role={role} companyId={role.company_id} onClose={() => setEditOpen(false)} />
        </Modal>
      )}

      {/* Fullscreen JD modal */}
      {jdOpen && (
        <Modal title={`Job Description — ${role.role_title}`} onClose={() => setJdOpen(false)} wide>
          <div className="space-y-4">
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 font-mono text-sm leading-relaxed text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setJdText(role.job_description); setJdOpen(false) }}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveJD}
                disabled={isJdPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {isJdPending ? 'Saving…' : 'Save JD'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
