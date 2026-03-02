'use client'

import { useState } from 'react'

export default function ExpandableNote({ note }: { note: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <p
      onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
      className={`mt-1 cursor-pointer text-xs text-zinc-400 transition-colors hover:text-zinc-600 ${
        expanded ? '' : 'line-clamp-1'
      }`}
    >
      {note}
    </p>
  )
}
