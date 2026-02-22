'use client'

import { useState } from 'react'
import ApplyForm from './ApplyForm'

type Resume = { id: string; version_name: string; file_url: string; created_at: string }
type Application = { id: string; status: string; resume_url: string | null; created_at: string }

type RoleInfo = {
  id: string
  role_title: string
  location: string
  salary_range: string | null
  job_description: string
  status: 'open' | 'closed'
  company_name: string
}

interface Props {
  role: RoleInfo
  application: Application | null
  resumes: Resume[]
  initialTab: 'overview' | 'jd' | 'apply'
}

const STATUS_BADGE: Record<string, string> = {
  applied:     'bg-blue-100 text-blue-700',
  shortlisted: 'bg-amber-100 text-amber-700',
  rejected:    'bg-red-100 text-red-700',
  hired:       'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<string, string> = {
  applied:     'Applied',
  shortlisted: 'In Process',
  rejected:    'Rejected',
  hired:       'Hired',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'jd',       label: 'Job Description' },
  { id: 'apply',    label: 'Apply' },
] as const

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="text-right text-sm font-medium text-zinc-900">{value}</span>
    </div>
  )
}

export default function RoleDetailTabs({ role, application, resumes, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'jd' | 'apply'>(initialTab)

  return (
    <div className="mt-5">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <Row label="Company"  value={role.company_name} />
            <Row label="Role"     value={role.role_title} />
            <Row label="Location" value={role.location} />
            {role.salary_range && <Row label="Salary" value={role.salary_range} />}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Status</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  role.status === 'open'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-zinc-100 text-zinc-500'
                }`}
              >
                {role.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
            {application && (
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                <span className="text-sm text-zinc-500">My Status</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_BADGE[application.status] ?? 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {STATUS_LABEL[application.status] ?? application.status}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Job Description */}
        {activeTab === 'jd' && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {role.job_description}
            </p>
          </div>
        )}

        {/* Apply */}
        {activeTab === 'apply' && (
          <ApplyForm
            roleId={role.id}
            roleStatus={role.status}
            application={application}
            resumes={resumes}
          />
        )}
      </div>
    </div>
  )
}
