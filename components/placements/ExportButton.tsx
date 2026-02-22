'use client'

import type { ApplicationWithLearner } from '@/types'

interface Props {
  applications: ApplicationWithLearner[]
  disabled: boolean
}

export default function ExportButton({ applications, disabled }: Props) {
  function handleExport() {
    const headers = ['Learner Name', 'Email', 'Company', 'Role', 'Location', 'Status', 'Resume URL', 'Applied Date']
    const rows = applications.map((a) => [
      a.learner_name,
      a.learner_email,
      a.company_name,
      a.role_title,
      a.location,
      a.status,
      a.resume_url ?? '',
      new Date(a.created_at).toLocaleDateString(),
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
    >
      Export CSV
    </button>
  )
}
