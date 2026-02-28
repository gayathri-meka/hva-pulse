'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { applyToRole } from '@/app/(learner)/learner/actions'

type Resume = { id: string; version_name: string; file_url: string }
type Application = {
  id: string
  status: string
  resume_url: string | null
  created_at: string
  not_shortlisted_reason: string | null
  rejection_feedback: string | null
}

interface Props {
  roleId: string
  roleStatus: 'open' | 'closed'
  location: string
  salaryRange: string | null
  application: Application | null
  resumes: Resume[]
}

const STATUS_BADGE: Record<string, string> = {
  applied:         'bg-blue-100 text-blue-700',
  shortlisted:     'bg-amber-100 text-amber-700',
  on_hold:         'bg-orange-100 text-orange-700',
  not_shortlisted: 'bg-zinc-100 text-zinc-600',
  rejected:        'bg-red-100 text-red-700',
  hired:           'bg-emerald-100 text-emerald-700',
}
const STATUS_LABEL: Record<string, string> = {
  applied:         'Applied',
  shortlisted:     'In Process',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
}

export default function ApplyForm({ roleId, roleStatus, location, salaryRange, application, resumes }: Props) {
  const router = useRouter()
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id ?? '')
  const [readJD, setReadJD]         = useState(false)
  const [okLocation, setOkLocation] = useState(false)
  const [okSalary, setOkSalary]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [submitted, setSubmitted]   = useState(false)
  const [isPending, startTransition] = useTransition()

  // Show already-applied state
  if (application || submitted) {
    const status = application?.status ?? 'applied'
    const note =
      status === 'not_shortlisted' ? application?.not_shortlisted_reason
      : status === 'rejected'      ? application?.rejection_feedback
      : null
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-emerald-600">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Application submitted</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {STATUS_LABEL[status] ?? status}
              </span>
              {application?.resume_url && (
                <a
                  href={application.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:underline"
                >
                  View resume →
                </a>
              )}
            </div>
          </div>
        </div>

        {note && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {status === 'not_shortlisted' ? 'Reason' : 'Feedback'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{note}</p>
          </div>
        )}
      </div>
    )
  }

  // Role closed
  if (roleStatus === 'closed') {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">This role is no longer accepting applications.</p>
      </div>
    )
  }

  const allChecked = readJD && okLocation && (salaryRange ? okSalary : true)

  function handleSubmit() {
    if (!allChecked) return
    setError(null)
    const selectedResume = resumes.find((r) => r.id === selectedResumeId)
    startTransition(async () => {
      const result = await applyToRole(roleId, selectedResume?.file_url ?? null)
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Apply for this role
      </h2>

      {resumes.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">No resume uploaded yet.</p>
          <p className="mt-1 text-xs text-amber-600">
            You need to upload a resume before you can apply.
          </p>
          <Link
            href="/learner/profile"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            Upload resume →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Resume select */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
              Select resume version
            </label>
            <div className="relative">
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>{r.version_name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Confirmation checkboxes */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Before you apply — confirm all of the following:
            </p>
            <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
              <Checkbox
                checked={readJD}
                onChange={setReadJD}
                label="I have read the full job description above"
              />
              <Checkbox
                checked={okLocation}
                onChange={setOkLocation}
                label={<>I am comfortable with the location: <strong className="text-zinc-900">{location}</strong></>}
              />
              {salaryRange && (
                <Checkbox
                  checked={okSalary}
                  onChange={setOkSalary}
                  label={<>I am comfortable with the salary range: <strong className="text-zinc-900">{salaryRange}</strong></>}
                />
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!allChecked || isPending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? 'Submitting…' : 'Submit Application'}
          </button>

          {!allChecked && (
            <p className="text-center text-xs text-zinc-400">
              Check all boxes above to enable the submit button.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        checked ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300 bg-white'
      }`}>
        {checked && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-sm leading-snug text-zinc-600">{label}</span>
    </label>
  )
}
