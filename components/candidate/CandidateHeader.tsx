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
    </header>
  )
}
