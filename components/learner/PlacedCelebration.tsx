'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

// Fires confetti once on first mount per browser session for a given learner —
// we don't want a placed learner to get blasted with confetti every page load,
// just on the first dashboard visit of the session. Uses sessionStorage so it
// resets per tab/session.
function fireConfettiOncePerSession(key: string): void {
  if (typeof window === 'undefined') return
  if (window.sessionStorage.getItem(key) === 'fired') return
  window.sessionStorage.setItem(key, 'fired')

  const duration = 1800
  const end      = Date.now() + duration

  function frame() {
    confetti({
      particleCount: 4,
      angle:         60,
      spread:        70,
      origin:        { x: 0, y: 0.7 },
      colors:        ['#5BAE5B', '#fbbf24', '#3b82f6', '#a855f7', '#ef4444'],
    })
    confetti({
      particleCount: 4,
      angle:         120,
      spread:        70,
      origin:        { x: 1, y: 0.7 },
      colors:        ['#5BAE5B', '#fbbf24', '#3b82f6', '#a855f7', '#ef4444'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }

  // Centre burst kicks it off, then side cannons fire continuously.
  confetti({
    particleCount: 120,
    spread:        90,
    origin:        { y: 0.55 },
    colors:        ['#5BAE5B', '#fbbf24', '#3b82f6', '#a855f7', '#ef4444'],
  })
  frame()
}

export default function PlacedCelebration({ firstName }: { firstName: string }) {
  useEffect(() => {
    fireConfettiOncePerSession('hva-placed-confetti')
  }, [])

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-emerald-600">
            <path d="M12 1.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 1.5ZM5.636 4.575a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061ZM18.364 4.575a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.06-1.06l1.06-1.061a.75.75 0 0 1 1.06 0ZM12 6a6 6 0 0 0-3.75 10.687v1.063a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75v-1.063A6 6 0 0 0 12 6ZM9.75 21a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75ZM10.5 22.5a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3ZM2.25 12a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75ZM19.5 12a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-emerald-900">
            Congratulations{firstName ? `, ${firstName}` : ''}! You&apos;re placed.
          </p>
          <p className="mt-1 text-sm text-emerald-800/80">
            We&apos;re thrilled for you. New roles are disabled — this dashboard now stays as a record of your journey.
          </p>
        </div>
      </div>
    </div>
  )
}
