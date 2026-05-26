'use client'

import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
    >
      Sign out
    </button>
  )
}
