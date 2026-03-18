'use client'

import type { ApplicationWithLearner } from '@/types'

interface Props {
  applications: ApplicationWithLearner[]
}

export default function ExportButton({ applications }: Props) {
  function handleExport() {
    const headers = [
      'Learner Name', 'Email', 'Company', 'Role', 'Location',
      'Status', 'Applied Date',
    ]
    const rows = applications.map((a) => [
      a.learner_name,
      a.learner_email,
      a.company_name,
      a.role_title,
      a.location ?? '',
      a.status,
      new Date(a.created_at).toLocaleDateString('en-GB'),
    ])

    const escape = (v: string) => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v

    // UTF-8 BOM for Google Sheets compatibility
    const csv = '\uFEFF' + [headers, ...rows]
      .map((row) => row.map((cell) => escape(String(cell ?? ''))).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={applications.length === 0}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      title="Download CSV"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      CSV
    </button>
  )
}
