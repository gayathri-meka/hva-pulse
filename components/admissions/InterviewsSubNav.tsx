'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRememberedNavRoutes } from '@/hooks/useRememberedNavRoutes'

const TABS = [
  { key: 'overview',  fallback: '/admissions/interviews',           label: 'Overview', exact: true },
  { key: 'calendar',  fallback: '/admissions/interviews/calendar',  label: 'My calendar', exact: false },
  { key: 'list',      fallback: '/admissions/interviews/list',      label: 'Interviews', exact: false },
  { key: 'notes',     fallback: '/admissions/interviews/notes',     label: 'Notes', exact: false },
  { key: 'questions', fallback: '/admissions/interviews/questions', label: 'Questions & rubrics', exact: false },
] as const

export default function InterviewsSubNav() {
  const pathname = usePathname()
  const rememberedHref = useRememberedNavRoutes('admissions-interviews', TABS)
  return (
    <div className="mb-5 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
      {TABS.map((tab) => {
        const { fallback, label, exact } = tab
        const active = exact ? pathname === fallback : pathname.startsWith(fallback)
        return (
          <Link
            key={tab.key}
            href={rememberedHref(tab)}
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
