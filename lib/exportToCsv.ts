import type { Table } from '@tanstack/react-table'

function cellValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join('; ')
  return String(value)
}

function csvEscape(value: string): string {
  // Wrap in quotes if the cell contains a comma, double-quote, or newline
  if (/[",\n\r]/.test(value)) return '"' + value.replace(/"/g, '""') + '"'
  return value
}

/**
 * Exports the currently visible + filtered rows of a TanStack Table v8 instance
 * as a UTF-8 CSV file (with BOM for Google Sheets compatibility).
 *
 * Only columns whose `header` is a plain string are included — action/edit
 * columns that use a render function are automatically skipped.
 */
export function exportToCsv<T>(table: Table<T>, filename: string): void {
  const cols = table
    .getVisibleLeafColumns()
    .filter((col) => typeof col.columnDef.header === 'string' && (col.columnDef.header as string).length > 0)

  const headerRow = cols.map((col) => csvEscape(col.columnDef.header as string)).join(',')

  const dataRows = table.getRowModel().rows.map((row) =>
    cols.map((col) => csvEscape(cellValue(row.getValue(col.id)))).join(','),
  )

  // UTF-8 BOM (\uFEFF) so Google Sheets / Excel render special characters correctly
  const csv = '\uFEFF' + [headerRow, ...dataRows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
