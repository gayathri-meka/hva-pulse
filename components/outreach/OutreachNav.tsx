'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRememberedNavRoutes } from '@/hooks/useRememberedNavRoutes'

const TABS = [
  { key: 'personas', fallback: '/outreach/personas', label: 'Job Personas' },
  { key: 'opportunities', fallback: '/outreach/opportunities', label: 'Potential Opportunities' },
] as const

export default function OutreachNav() {
  const pathname = usePathname()
  const rememberedHref = useRememberedNavRoutes('outreach', TABS)

  return (
    <div className="flex gap-1 border-b border-zinc-200">
      {TABS.map((tab) => {
        const { fallback, label } = tab
        const active = pathname === fallback || pathname.startsWith(`${fallback}/`)
        return (
          <Link
            key={tab.key}
            href={rememberedHref(tab)}
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
