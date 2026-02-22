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
  const [expanded, setExpanded] = useState(true)
  const [editCompanyOpen, setEditCompanyOpen] = useState(false)
  const [addRoleOpen, setAddRoleOpen] = useState(false)

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Toggle chevron */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Company name */}
          <p className="flex-1 font-bold text-zinc-900">{company.company_name}</p>

          {/* Role count badge */}
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
            {company.roles.length} role{company.roles.length !== 1 ? 's' : ''}
          </span>

          {/* Edit company */}
          <button
            onClick={() => setEditCompanyOpen(true)}
            title="Edit company"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Add role */}
          <button
            onClick={() => setAddRoleOpen(true)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            + Add role
          </button>
        </div>

        {/* Role list */}
        {expanded && (
          <div className="border-t border-zinc-100 px-5 py-3 space-y-2">
            {company.roles.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-400">
                No roles yet.{' '}
                <button
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

      {editCompanyOpen && (
        <Modal title="Edit company" onClose={() => setEditCompanyOpen(false)}>
          <CompanyForm company={company} onClose={() => setEditCompanyOpen(false)} />
        </Modal>
      )}

      {addRoleOpen && (
        <Modal title="Add role" onClose={() => setAddRoleOpen(false)}>
          <RoleForm companyId={company.id} onClose={() => setAddRoleOpen(false)} />
        </Modal>
      )}
    </>
  )
}
