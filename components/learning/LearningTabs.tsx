'use client'

import { useRouter } from 'next/navigation'
import { useNavigationLoader } from '@/components/GlobalNavigationLoader'

export type LearningTab = {
  key:   string
  label: string
  href:  string
}

// Top-level Learning tabs. Most switches are searchParam-only (?filter=all vs
// ?filter=interventions) which Next.js doesn't treat as a route segment
// change, so loading.tsx never fires. Triggering the global loader via the
// shared hook gives consistent behaviour with every other in-app navigation.
export default function LearningTabs({ tabs, activeKey }: { tabs: LearningTab[]; activeKey: string }) {
  const router       = useRouter()
  const { start }    = useNavigationLoader()

  function navigate(href: string) {
    start()
    router.push(href)
  }

  return (
    <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
      {tabs.map(({ key, label, href }) => {
        const active = key === activeKey
        return (
          <button
            key={key}
            onClick={() => navigate(href)}
            className={`relative pb-3 px-1 mr-4 text-sm font-medium transition-colors ${
              active ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {active && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </button>
        )
      })}
    </div>
  )
}
