'use client'

import { IconLogout } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase'

export default function InterviewerHeader({ name }: { name: string }) {
  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <div className="text-sm font-semibold text-zinc-900">HyperVerge Academy · Interviews</div>
          <div className="text-xs text-zinc-500">{name}</div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          <IconLogout size={14} /> Sign out
        </button>
      </div>
    </header>
  )
}
