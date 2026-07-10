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
    <div className="mb-5 flex gap-1">
      {TABS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
