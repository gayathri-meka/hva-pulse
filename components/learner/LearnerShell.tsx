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

interface ShellProps {
  children:      React.ReactNode
  impersonating: boolean
  previewMode:   'mobile' | 'desktop'
}

export default function LearnerShell({ children, impersonating, previewMode }: ShellProps) {
  const pathname    = usePathname()
  const forceMobile = impersonating && previewMode === 'mobile'

  // The phone-frame: when admin is in mobile preview, constrain the inner content to
  // phone width and add a chrome to make it visually distinct. The @container directive
  // lets nested content respond to container width (not viewport), so phone-frame
  // contents render the real mobile layout regardless of the admin's screen size.
  // overflow-y-auto + max-h gives the frame its own scroll context so sticky header
  // and bottom nav inside it anchor to the frame, not the viewport.
  const containerClass = forceMobile
    ? 'relative mx-auto my-6 max-w-md max-h-[calc(100vh-6rem)] overflow-x-hidden overflow-y-auto @container border border-zinc-200 bg-white shadow-xl rounded-2xl'
    : 'mx-auto @container w-full'

  return (
    <div className={`min-h-screen ${forceMobile ? 'bg-zinc-100' : 'bg-zinc-50'}`}>
      <div className={containerClass}>
        {/* Top header — dark, matching admin sidebar branding */}
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            {/* Brand */}
            <Link href="/learner" className="shrink-0">
              <Image
                src="/Dark%20BG/Dark.png"
                alt="HVA"
                width={800}
                height={200}
                className="h-6 w-auto"
              />
            </Link>

            {/* Nav — always visible */}
            <nav className="flex gap-1">
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
        <main className="pb-6">{children}</main>
      </div>
    </div>
  )
}
