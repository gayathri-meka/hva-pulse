'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admissions/interviews', label: 'Overview', exact: true },
  { href: '/admissions/interviews/calendar', label: 'My calendar', exact: false },
]

export default function InterviewsSubNav() {
  const pathname = usePathname()
  return (
    <div className="mb-5 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
      {TABS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1 transition-colors ${
              active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
