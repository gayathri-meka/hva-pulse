'use client'

import { useState } from 'react'
import Modal from './Modal'
import CompanyForm from './CompanyForm'
import RoleForm from './RoleForm'
import RoleRow from './RoleRow'
import type { CompanyWithRoles } from '@/types'

interface Props {
  company: CompanyWithRoles
}

export default function CompanyAccordion({ company }: Props) {
  const [expanded, setExpanded]           = useState(true)
  const [editCompanyOpen, setEditCompanyOpen] = useState(false)
  const [addRoleOpen, setAddRoleOpen]     = useState(false)

  const totalApplicants    = company.roles.reduce((s, r) => s + r.applicant_count, 0)
  const totalHired         = company.roles.reduce((s, r) => s + r.hired_count, 0)
  const totalNotInterested = company.roles.reduce((s, r) => s + r.not_interested_count, 0)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4">
          {/* Toggle button: chevron + name + role count + stats */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 text-left"
            aria-expanded={expanded}
          >
            <div className="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 transition-transform text-zinc-400 ${expanded ? 'rotate-0' : '-rotate-90'}`}
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-zinc-900">{company.company_name}</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                {company.roles.length} role{company.roles.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Stat chips — always visible */}
            {company.roles.length > 0 && (
              <div className="ml-6 mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {totalApplicants} applied
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {totalHired} hired
                </span>
                {totalNotInterested > 0 && (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                    {totalNotInterested} not interested
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Right-side action buttons (not part of toggle) */}
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
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
              onClick={() => setAddRoleOpen(true)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              + Add role
            </button>
          </div>
        </div>

        {/* Role list */}
        {expanded && (
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
        <Modal title="Add role" onClose={() => setAddRoleOpen(false)} full>
          <RoleForm companyId={company.id} onClose={() => setAddRoleOpen(false)} />
        </Modal>
      )}
    </>
  )
}
