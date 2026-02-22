'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { uploadResume, deleteResume } from '@/app/(learner)/learner/actions'

type Resume = { id: string; version_name: string; file_url: string; created_at: string }

export default function ResumeManager({ resumes }: { resumes: Resume[] }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [versionName, setVersionName] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await uploadResume(formData)
      if (result.error) {
        setUploadError(result.error)
      } else {
        setVersionName('')
        formRef.current?.reset()
        router.refresh()
      }
    })
  }

  function handleDelete(id: string, fileUrl: string) {
    startTransition(async () => {
      await deleteResume(id, fileUrl)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <form
        ref={formRef}
        onSubmit={handleUpload}
        className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-white p-5"
      >
        <p className="text-xs font-medium text-zinc-500">Upload resume (PDF only)</p>

        <input
          name="version_name"
          type="text"
          placeholder='Version name (e.g. "v1" or "Jan 2025")'
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />

        <div className="flex items-center gap-3">
          <input
            name="file"
            type="file"
            accept="application/pdf"
            required
            className="min-w-0 flex-1 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      </form>

      {/* Resume list */}
      {resumes.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">No resumes uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">{resume.version_name}</p>
                <p className="text-xs text-zinc-400">
                  Uploaded {new Date(resume.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-3">
                <a
                  href={resume.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:underline"
                >
                  View
                </a>
                <button
                  onClick={() => handleDelete(resume.id, resume.file_url)}
                  disabled={isPending}
                  className="text-xs text-red-400 transition-colors hover:text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
