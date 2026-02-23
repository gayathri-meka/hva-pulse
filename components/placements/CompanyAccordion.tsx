'use client'

import { useState, useTransition } from 'react'
import Modal from './Modal'
import CompanyForm from './CompanyForm'
import RoleForm from './RoleForm'
import RoleRow from './RoleRow'
import { deleteCompany } from '@/app/(protected)/placements/actions'
import type { CompanyWithRoles } from '@/types'

interface Props {
  company:  CompanyWithRoles
  isOpen:   boolean
  onToggle: () => void
}

export default function CompanyAccordion({ company, isOpen, onToggle }: Props) {
  const [editCompanyOpen, setEditCompanyOpen] = useState(false)
  const [addRoleOpen, setAddRoleOpen]         = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)
  const [isPending, startTransition]          = useTransition()

  function handleDelete() {
    startTransition(() => deleteCompany(company.id))
  }

  const totalApplicants   = company.roles.reduce((s, r) => s + r.applicant_count, 0)
  const totalHired        = company.roles.reduce((s, r) => s + r.hired_count, 0)
  const totalNI           = company.roles.reduce((s, r) => s + r.not_interested_count, 0)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4">
          {/* Toggle button: chevron + name + role count + stats */}
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 text-left"
            aria-expanded={isOpen}
          >
            <div className="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 transition-transform text-zinc-400 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-zinc-900">{company.company_name}</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                {company.roles.length} role{company.roles.length !== 1 ? 's' : ''}
              </span>
            </div>

          </button>

          {/* Right-side: stat chips + action buttons */}
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {company.roles.length > 0 && (
              <>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {totalApplicants} applied
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {totalHired} hired
                </span>
                {totalNI > 0 && (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                    {totalNI} not interested
                  </span>
                )}
                <div className="mx-1 h-4 w-px bg-zinc-200" />
              </>
            )}
            {confirmDelete ? (
              <>
                <span className="text-xs text-zinc-500">Delete company?</span>
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
              <>
                <button
                  type="button"
                  onClick={() => setEditCompanyOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  title="Delete company"
                  className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                  </svg>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setAddRoleOpen(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              + Add role
            </button>
          </div>
        </div>

        {/* Role list */}
        {isOpen && (
          <div className="border-t border-zinc-100 px-5 py-3 space-y-2">
            {company.roles.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                No roles yet.{' '}
                <button
                  type="button"
                  onClick={() => setAddRoleOpen(true)}
                  className="font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
                >
                  Add the first one
                </button>
              </p>
            ) : (
              company.roles.map((role) => (
                <RoleRow key={role.id} role={role} companyName={company.company_name} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit company modal — regular size */}
      {editCompanyOpen && (
        <Modal title="Edit company" onClose={() => setEditCompanyOpen(false)}>
          <CompanyForm company={company} onClose={() => setEditCompanyOpen(false)} />
        </Modal>
      )}

      {/* Add role modal — fullscreen */}
      {addRoleOpen && (
        <Modal title={`Add role — ${company.company_name}`} onClose={() => setAddRoleOpen(false)} full>
          <RoleForm companyId={company.id} onClose={() => setAddRoleOpen(false)} />
        </Modal>
      )}
    </>
  )
}
