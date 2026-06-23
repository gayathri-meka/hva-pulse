'use client'

import { useState, useTransition } from 'react'
import type { SyncToSheetResult } from '@/lib/sheetSync'

// Reusable "Sync to Sheets" button + modal. Drop it next to any table: pass a
// server action that runs the actual sync (so the column mapping lives server-
// side) and the service-account email the user must share their sheet with.
export default function SyncToSheetButton({
  action,
  serviceAccountEmail,
  label = 'Sync to Sheets',
  title = 'Sync to Google Sheets',
}: {
  action: (sheetUrl: string, tab: string) => Promise<SyncToSheetResult>
  serviceAccountEmail: string
  label?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<SyncToSheetResult | null>(null)
  const [pending, startTransition] = useTransition()

  function run() {
    if (!url.trim() || pending) return
    setResult(null)
    startTransition(async () => {
      try {
        setResult(await action(url.trim(), tab.trim()))
      } catch (e) {
        setResult({ ok: false, error: String((e as Error)?.message ?? e) })
      }
    })
  }

  function copyEmail() {
    navigator.clipboard?.writeText(serviceAccountEmail).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
        title={label}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#5BAE5B]">
          <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25Zm5 3.5a.75.75 0 0 0-1.5 0V8H5.5a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0V9.5h2.25a.75.75 0 0 0 0-1.5H9.25V5.5Z" clipRule="evenodd" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* Step 1 — share with the service account */}
              <div>
                <p className="text-xs font-semibold text-zinc-700">1. Share your sheet with this account as <span className="text-zinc-900">Editor</span></p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[11px] text-zinc-700">{serviceAccountEmail || '—'}</code>
                  <button
                    onClick={copyEmail}
                    disabled={!serviceAccountEmail}
                    className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Step 2 — sheet link */}
              <div>
                <p className="text-xs font-semibold text-zinc-700">2. Paste the Google Sheet link</p>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
                />
                <input
                  type="text"
                  value={tab}
                  onChange={(e) => setTab(e.target.value)}
                  placeholder="Tab name (optional — defaults to the first tab)"
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-zinc-400">
                Only the columns from this table are written. Any other columns you keep in the sheet are left untouched, and rows are matched so your notes stay aligned.
              </p>

              {result && (
                result.ok ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    ✓ Synced — {result.stats.added} added, {result.stats.updated} updated, {result.stats.unchanged} unchanged.
                  </p>
                ) : (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{result.error}</p>
                )
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700">
                Close
              </button>
              <button
                onClick={run}
                disabled={pending || !url.trim()}
                className="rounded-lg bg-[#5BAE5B] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4e9d4e] disabled:opacity-40"
              >
                {pending ? 'Syncing…' : 'Sync now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
