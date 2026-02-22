import { useCallback, useRef, useState } from 'react'

/**
 * Returns stable widths array + a mousedown handler to start a column drag.
 * Usage:
 *   const { widths, onResizeStart } = useColumnResize([200, 200, 120, 120, 80])
 *   <th style={{ width: widths[0] }} className="relative">
 *     Header
 *     <div className="resize-handle" onMouseDown={(e) => onResizeStart(0, e)} />
 *   </th>
 */
export function useColumnResize(initialWidths: number[]) {
  const [widths, setWidths] = useState(initialWidths)
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const onResizeStart = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = widthsRef.current[col]

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      setWidths((prev) => {
        const next = [...prev]
        next[col] = Math.max(60, startW + delta)
        return next
      })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return { widths, onResizeStart }
}
