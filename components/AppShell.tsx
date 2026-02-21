'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({
  role,
  children,
}: {
  role: 'admin' | 'lf'
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar wrapper — fixed overlay on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-60 flex-shrink-0 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} onClose={() => setOpen(false)} />
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-14 flex-shrink-0 items-center border-b border-zinc-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
            aria-label="Open menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <span className="ml-3 text-base font-semibold">HVA Pulse</span>
        </header>

        {/* Page content — only this scrolls */}
        <main className="flex-1 overflow-auto p-5 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
