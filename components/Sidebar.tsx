'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/actions'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/learners', label: 'Learners' },
  { href: '/lfs', label: 'LFs' },
]

export default function Sidebar() {
  const pathname = usePathname()

  if (pathname === '/login') return null

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r bg-gray-100">
      <div className="p-6">
        <span className="text-lg font-bold tracking-tight">Pulse</span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-black shadow-sm'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-black'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto p-4">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-200 hover:text-black"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
