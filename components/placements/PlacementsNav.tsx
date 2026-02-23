'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/placements/companies', label: 'Companies' },
  { href: '/placements/applications', label: 'Applications' },
  { href: '/placements/matching', label: 'Learners' },
  { href: '/placements/analytics', label: 'Analytics' },
]

export default function PlacementsNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-zinc-200">
      {TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#5BAE5B]" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
