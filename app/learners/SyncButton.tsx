'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleSync() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage(`Synced ${data.count} learners`)
        router.refresh()
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch {
      setMessage('Sync failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? 'Syncing...' : 'Sync from Google Sheet'}
      </button>
      {message && <span className="text-sm text-gray-500">{message}</span>}
    </div>
  )
}
