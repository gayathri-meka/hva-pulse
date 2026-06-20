'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IconCheck, IconLogout } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase'

const STAGES = [
  { slug: 'welcome', label: 'Welcome' },
  { slug: 'interest-form', label: 'Personal Information' },
  { slug: 'challenge', label: 'Challenge' },
  { slug: 'interview', label: 'Interview' },
  { slug: 'selection', label: 'Selection' },
]

// Quick links surfaced under the stepper so learners can always jump to the
// places they actually work — the LMS and the community.
const SENSAI_URL = 'https://sensai.hyperverge.org'
const SLACK_URL =
  'https://hypervergeacademy.slack.com/join/shared_invite/zt-38v9tch9i-yPfd4rsXkthZuuRvE1SZSw#/shared-invite/email'

export default function CandidateHeader({
  completedStages = [],
}: {
  completedStages?: string[]
}) {
  const pathname = usePathname()
  const currentSlug = pathname.split('/')[2] ?? 'welcome'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-20 bg-[#0f1f0f] text-white">
      {/* Top row: logo + sign out */}
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/candidate/welcome" aria-label="HVA home" className="flex items-center">
          <Image
            src="/Dark BG/Dark.svg"
            alt="HyperVerge Academy"
            width={110}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          className="group flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/80 transition-all hover:border-rose-300/60 hover:bg-rose-500/25 hover:text-rose-100"
        >
          <IconLogout
            size={14}
            stroke={2.2}
            className="transition-transform group-hover:-rotate-12"
          />
          Sign out
        </button>
      </div>

      {/* Stage stepper */}
      <nav
        aria-label="Application stages"
        className="border-t border-white/10"
      >
        <div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto px-4 py-4 sm:justify-center sm:gap-5 sm:px-6 sm:py-5">
          {STAGES.map((stage, i) => {
            const isCurrent = stage.slug === currentSlug
            const isCompleted = completedStages.includes(stage.slug)
            // The Personal Information step is required before anything else —
            // flag it red until the form is submitted, even while it's current.
            const needsAction = stage.slug === 'interest-form' && !isCompleted
            return (
              <Link
                key={stage.slug}
                href={`/candidate/${stage.slug}`}
                className={`group flex flex-shrink-0 items-center gap-2 rounded-full px-2 py-1 transition-all ${
                  needsAction ? 'hover:bg-rose-500/25' : 'hover:bg-[#16a34a]/25'
                }`}
              >
                <span
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-extrabold transition-all ${
                    needsAction
                      ? ''
                      : isCurrent
                        ? 'border-[#15803d] bg-[#16a34a] text-white group-hover:bg-[#22c55e] group-hover:shadow-[0_0_0_4px_rgba(34,197,94,0.25)]'
                        : isCompleted
                          ? 'border-[#15803d] bg-[#16a34a]/85 text-white group-hover:bg-[#22c55e]'
                          : 'border-white/20 bg-white/5 text-white/50 group-hover:border-[#86efac] group-hover:bg-[#16a34a]/40 group-hover:text-white'
                  }`}
                  // Inline styles: newly-added arbitrary Tailwind classes don't make it
                  // into this project's compiled CSS, so colour via style to be safe.
                  style={
                    needsAction
                      ? { borderColor: '#fca5a5', backgroundColor: '#ef4444', color: '#ffffff' }
                      : undefined
                  }
                >
                  {isCompleted ? <IconCheck size={14} stroke={3} /> : i + 1}
                  {needsAction && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ backgroundColor: '#fecaca' }}
                      />
                      <span
                        className="relative inline-flex h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: '#fecaca', border: '1px solid #0f1f0f' }}
                      />
                    </span>
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-[13px] font-bold transition-colors ${
                    needsAction
                      ? ''
                      : isCurrent
                        ? 'text-[#bbf7d0] group-hover:text-white'
                        : isCompleted
                          ? 'text-[#bbf7d0]/80 group-hover:text-white'
                          : 'text-white/50 group-hover:text-[#bbf7d0]'
                  }`}
                  style={needsAction ? { color: '#fca5a5' } : undefined}
                >
                  {stage.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Quick links — jump straight to the LMS / community */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 overflow-x-auto px-4 py-2.5 sm:justify-center sm:gap-3 sm:px-6">
          <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Quick links
          </span>
          <a
            href={SENSAI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/80 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <SensaiMark />
            SensAI
          </a>
          <a
            href={SLACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-white/80 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <SlackMark />
            Slack
          </a>
        </div>
      </div>
    </header>
  )
}

// SensAI mark — no official asset bundled, so a brand-green spark stands in.
// Swap for a real logo SVG/PNG (drop it in /public) when one's available.
function SensaiMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0"
      fill="none"
      stroke="#5BAE5B"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
      <path d="M19 14l.7 1.8 1.8.7-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  )
}

// Official Slack logo (4-colour mark).
function SlackMark() {
  return (
    <svg viewBox="0 0 122.8 122.8" className="h-3.5 w-3.5 flex-shrink-0" aria-hidden>
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A" />
      <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#E01E5A" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36C5F0" />
      <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2EB67D" />
      <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ECB22E" />
      <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ECB22E" />
    </svg>
  )
}
