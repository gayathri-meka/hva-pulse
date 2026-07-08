'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { disconnectEmailAccount } from './actions'

export default function DisconnectButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
      >
        Disconnect
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-500">Disconnect this account?</span>
      <button
        disabled={pending}
        onClick={() => start(async () => { await disconnectEmailAccount(); router.refresh() })}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pending ? 'Disconnecting…' : 'Yes, disconnect'}
      </button>
      <button onClick={() => setConfirming(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
        Cancel
      </button>
    </div>
  )
}
