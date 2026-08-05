'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Tooltip — a styled hover tooltip that matches the Pulse design language (dark zinc-900 bubble,
 * white text, rounded, subtle shadow), replacing the browser's native `title` tooltip.
 *
 * Renders the tooltip via a portal to `document.body` with `position: fixed`, so it is never clipped
 * by a scrolling/`overflow-hidden` ancestor (e.g. a table body). The tooltip DOM only mounts while
 * hovered, so there's no cost at rest — cheap enough to use on every cell.
 *
 * Usage:
 *   <Tooltip content="Full text here"><button>Hover me</button></Tooltip>
 *
 * For truncated table cells, pass `truncate`: the trigger becomes a single-line truncating block and
 * the tooltip only appears when the text actually overflows (no redundant tooltip on short values):
 *   <Tooltip content={fullName} truncate>{fullName}</Tooltip>
 */
export default function Tooltip({
  content,
  children,
  truncate = false,
  className,
}: {
  content: React.ReactNode
  children: React.ReactNode
  truncate?: boolean
  className?: string
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)

  function show() {
    const el = triggerRef.current
    if (!el || content == null || content === '') return
    // In truncate mode, only show when the text is actually clipped.
    if (truncate && el.scrollWidth <= el.clientWidth) return
    const r = el.getBoundingClientRect()
    setCoords({ x: r.left + r.width / 2, y: r.bottom })
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={() => setCoords(null)}
        className={`${truncate ? 'block truncate' : 'inline-block max-w-full align-middle'} ${className ?? ''}`}
      >
        {children}
      </span>
      {coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', left: coords.x, top: coords.y, transform: 'translate(-50%, 8px)' }}
            className="pointer-events-none z-[200] max-w-xs rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          >
            {/* upward arrow */}
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900" />
            <span className="relative whitespace-normal break-words">{content}</span>
          </div>,
          document.body,
        )}
    </>
  )
}
