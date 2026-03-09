'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const OUTREACH_SUBTABS = [
  { href: '/placements/personas',      label: 'Job Personas'            },
  { href: '/placements/opportunities', label: 'Potential Opportunities' },
]

const TABS = [
  { href: '/placements/personas',      label: 'Job Outreach',   isOutreach: true  },
  { href: '/placements/companies',     label: 'Companies',      isOutreach: false },
  { href: '/placements/applications',  label: 'Applications',   isOutreach: false },
  { href: '/placements/not-interested', label: 'Not Interested', isOutreach: false },
  { href: '/placements/matching',      label: 'Matching',       isOutreach: false },
  { href: '/placements/analytics',     label: 'Analytics',      isOutreach: false },
]

const OUTREACH_PATHS = OUTREACH_SUBTABS.map((t) => t.href)

export default function PlacementsNav() {
  const pathname = usePathname()

  const outreachActive = OUTREACH_PATHS.some((p) => pathname.startsWith(p))

  return (
    <div>
      {/* Primary tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map(({ href, label, isOutreach }) => {
          const active = isOutreach
            ? outreachActive
            : pathname.startsWith(href)
          return (
            <Link
              key={label}
              href={href}
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
            return (
              <Link
                key={href}
                href={href}
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
