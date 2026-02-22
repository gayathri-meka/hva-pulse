'use client'

import { useEffect } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  full?: boolean
}

export default function Modal({ title, onClose, children, wide, full }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const panelClass = full
    ? 'h-[95vh] w-[95vw] max-w-none'
    : wide
    ? 'max-w-4xl w-full'
    : 'max-w-lg w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className={`relative flex flex-col rounded-xl bg-white shadow-xl ${panelClass}`}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={full ? 'flex flex-1 flex-col overflow-hidden p-6' : 'p-6'}>
          {children}
        </div>
      </div>
    </div>
  )
}
