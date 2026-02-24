'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/learner',         label: 'Dashboard' },
  { href: '/learner/profile', label: 'Profile' },
]

function isActive(href: string, pathname: string) {
  return href === '/learner' ? pathname === '/learner' : pathname.startsWith(href)
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}


function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )
}

const ICONS = [HomeIcon, UserIcon]

export default function LearnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top header — dark, matching admin sidebar branding */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <Link href="/learner">
            <Image
              src="/Dark%20BG/Dark.png"
              alt="HVA"
              width={800}
              height={200}
              className="h-6 w-auto"
            />
          </Link>

          {/* Desktop nav — hidden on mobile (bottom nav takes over) */}
          <nav className="hidden gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = isActive(href, pathname)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="pb-20 md:pb-6">{children}</main>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white md:hidden">
        <div className="grid grid-cols-2">
          {NAV_ITEMS.map(({ href, label }, i) => {
            const Icon = ICONS[i]
            const active = isActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? 'text-zinc-900' : 'text-zinc-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
