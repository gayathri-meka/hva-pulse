'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()
  // True when the visitor arrived from the apply form's tokened link — we
  // auto-kick the OAuth redirect instead of showing the manual sign-in card.
  const [autoRedirecting, setAutoRedirecting] = useState(false)
  const fired = useRef(false)

  async function handleGoogleLogin() {
    // Forward a marketing-form attribution token (?signup_token=<uuid>) through
    // the OAuth round-trip. Supabase owns the `state` param, so we can't use it
    // — but it preserves redirectTo's query string and only appends its own
    // ?code=..., so the token arrives intact at /auth/callback. Treated as an
    // opaque string (no format validation beyond non-empty).
    const redirectTo = new URL('/auth/callback', window.location.origin)
    const token = new URLSearchParams(window.location.search).get('signup_token')?.trim()
    if (token) redirectTo.searchParams.set('signup_token', token)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
      },
    })
  }

  // Auto-start the redirect when a signup_token is present. Guard with a ref so
  // React Strict Mode's double-invoke (and re-renders) can't fire OAuth twice.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('signup_token')?.trim()
    if (!token || fired.current) return
    fired.current = true
    setAutoRedirecting(true)
    void handleGoogleLogin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <Image
              src="/Icon/Light%20BG.png"
              alt="HVA"
              width={391}
              height={500}
              className="h-14 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">HVA Pulse</h1>
          <p className="mt-1.5 text-sm text-zinc-500">HVA Operating System</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {autoRedirecting ? (
            <div className="mb-5 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <svg className="h-4 w-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Redirecting to Google…
            </div>
          ) : (
            <p className="mb-5 text-center text-sm text-zinc-500">Sign in to continue</p>
          )}

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            {/* Google logo */}
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {autoRedirecting && (
            <p className="mt-3 text-center text-xs text-zinc-400">
              Not redirected automatically? Use the button above.
            </p>
          )}
        </div>

      </div>
    </main>
  )
}
