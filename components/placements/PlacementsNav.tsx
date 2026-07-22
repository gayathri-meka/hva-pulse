'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRememberedNavRoutes } from '@/hooks/useRememberedNavRoutes'

const OUTREACH_SUBTABS = [
  { href: '/placements/personas',      label: 'Job Personas'            },
  { href: '/placements/opportunities', label: 'Potential Opportunities' },
]

const TABS = [
  { key: 'analytics',      fallback: '/placements/analytics',      label: 'Analytics',      adminOnly: false },
  { key: 'companies',      fallback: '/placements/companies',      label: 'Companies',      adminOnly: false },
  { key: 'applications',   fallback: '/placements/applications',   label: 'Applications',   adminOnly: false },
  { key: 'not-interested', fallback: '/placements/not-interested', label: 'Not Interested', adminOnly: false },
  { key: 'matching',       fallback: '/placements/matching',       label: 'Learners',       adminOnly: false },
  { key: 'job-outreach',   fallback: '/placements/personas',       prefixes: OUTREACH_SUBTABS.map((tab) => tab.href), label: 'Job Outreach', adminOnly: false },
  { key: 'settings',       fallback: '/placements/settings',       label: 'Settings',       adminOnly: true  },
] as const

const OUTREACH_PATHS = OUTREACH_SUBTABS.map((t) => t.href)
const OUTREACH_GROUPS = OUTREACH_SUBTABS.map((tab) => ({ key: tab.href, fallback: tab.href }))

export default function PlacementsNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const rememberedHref = useRememberedNavRoutes('placements', TABS)
  const rememberedOutreachHref = useRememberedNavRoutes(
    'placements-job-outreach',
    OUTREACH_GROUPS,
  )

  const outreachActive = OUTREACH_PATHS.some((p) => pathname.startsWith(p))

  return (
    <div>
      {/* Primary tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((tab) => {
          const { fallback, label } = tab
          const active = (tab.key === 'job-outreach')
            ? outreachActive
            : pathname === fallback || pathname.startsWith(`${fallback}/`)
          return (
            <Link
              key={label}
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

      {/* Sub-tabs — only visible when inside Job Outreach */}
      {outreachActive && (
        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-zinc-200">
          {OUTREACH_SUBTABS.map(({ href, label }) => {
            const active = pathname.startsWith(href)
            const group = { key: href, fallback: href }
            return (
              <Link
                key={href}
                href={rememberedOutreachHref(group)}
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
      )}
    </div>
  )
}
