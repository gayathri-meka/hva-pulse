'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRememberedNavRoutes } from '@/hooks/useRememberedNavRoutes'

const TABS = [
  { key: 'website-hits', fallback: '/admissions/learner-applications', label: 'Website hits' },
  { key: 'prospects',    fallback: '/admissions/prospects',            label: 'Prospects' },
  { key: 'challenge',    fallback: '/admissions/challenge',            label: 'Challenge' },
  { key: 'interviews',   fallback: '/admissions/interviews',           label: 'Interviews' },
  { key: 'analytics',    fallback: '/admissions/analytics',            label: 'Analytics' },
] as const

export default function AdmissionsNav() {
  const pathname = usePathname()
  const rememberedHref = useRememberedNavRoutes('admissions', TABS)

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
      {TABS.map((tab) => {
        const { fallback, label } = tab
        const active = pathname === fallback || pathname.startsWith(`${fallback}/`)
        return (
          <Link
            key={tab.key}
            href={rememberedHref(tab)}
            className={`relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors md:px-4 ${
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
