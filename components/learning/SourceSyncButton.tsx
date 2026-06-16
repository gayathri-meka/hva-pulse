'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncDataSource } from '@/app/(protected)/learning/actions'

export type SyncSource = {
  id: string
  name: string
  last_synced_at: string | null
  sync_error: string | null
  row_count: number | null
}

// Compact "Sync now" control for the Completion tab header. Same underlying
// action as the per-source button in Settings → Data Sources (admin-only), but
// surfaced where the data is actually viewed so admins can refresh without
// hopping to Settings. Syncs every source feeding the tab, then refreshes the
// server component so the new metric_raw_rows show immediately.
export default function SourceSyncButton({ sources }: { sources: SyncSource[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  if (sources.length === 0) return null

  function handleSync() {
    setError('')
    startTransition(async () => {
      try {
        for (const s of sources) await syncDataSource(s.id)
        router.refresh()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  // Freshness floor = the oldest last_synced_at across the feeding sources.
  const oldestSync = sources.reduce<string | null>((acc, s) => {
    if (!s.last_synced_at) return acc
    if (!acc) return s.last_synced_at
    return s.last_synced_at < acc ? s.last_synced_at : acc
  }, null)
  const anyError = sources.find((s) => s.sync_error)?.sync_error ?? null

  const dot = anyError ? 'bg-[#E24B4A]' : oldestSync ? 'bg-[#5BAE5B]' : 'bg-amber-400'
  const status = anyError ?? (oldestSync ? `Synced ${formatRelative(oldestSync)}` : 'Never synced')

  return (
    <div className="flex items-center gap-2.5 text-xs text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className={anyError ? 'text-[#E24B4A]' : ''}>{status}</span>
      </span>
      <button
        onClick={handleSync}
        disabled={isPending}
        className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? 'Syncing…' : 'Sync now'}
      </button>
      {error && <span className="text-red-500">{error}</span>}
    </div>
  )
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
