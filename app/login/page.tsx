'use client'

import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold">Pulse</h1>
        <p className="text-gray-500">Sign in to continue</p>
        <button
          onClick={handleGoogleLogin}
          className="rounded-md bg-black px-6 py-3 text-white hover:bg-gray-800"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
