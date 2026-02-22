'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { applyToRole } from '@/app/(learner)/learner/actions'

type Resume = { id: string; version_name: string; file_url: string }
type Application = { id: string; status: string; resume_url: string | null; created_at: string }

interface Props {
  roleId: string
  roleStatus: 'open' | 'closed'
  application: Application | null
  resumes: Resume[]
}

const STATUS_LABEL: Record<string, string> = {
  applied:     'Applied',
  shortlisted: 'In Process',
  rejected:    'Rejected',
  hired:       'Hired',
}

export default function ApplyForm({ roleId, roleStatus, application, resumes }: Props) {
  const router = useRouter()
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Already applied
  if (application || submitted) {
    const status = application?.status ?? 'applied'
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2">
        <p className="text-sm font-medium text-zinc-700">You have applied to this role.</p>
        <p className="text-xs text-zinc-400">
          Status:{' '}
          <span className="font-medium text-zinc-700">
            {STATUS_LABEL[status] ?? status}
          </span>
        </p>
        {application?.resume_url && (
          <a
            href={application.resume_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-emerald-600 hover:underline"
          >
            View submitted resume
          </a>
        )}
      </div>
    )
  }

  // Role closed
  if (roleStatus === 'closed') {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm text-zinc-500">Applications for this role are closed.</p>
      </div>
    )
  }

  function handleSubmit() {
    if (!confirmed) {
      setError('Please confirm you want to apply.')
      return
    }
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
    <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
      {resumes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          You haven&apos;t uploaded a resume yet.{' '}
          <Link href="/learner/profile" className="font-medium text-zinc-900 hover:underline">
            Upload one in your profile
          </Link>
          .
        </p>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Select resume
            </label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.version_name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-600">
              I confirm I want to apply to this role.
            </span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Submitting…' : 'Submit Application'}
          </button>
        </>
      )}
    </div>
  )
}
