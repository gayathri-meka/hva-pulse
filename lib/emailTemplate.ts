// Generic <<placeholder>> templating for mail-merge. A template like
// "Hi <<name>>" is rendered per row by substituting the row's fields.

const PLACEHOLDER = /<<\s*(\w+)\s*>>/g

/** Distinct field names referenced as <<field>> in the text. */
export function extractPlaceholders(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(PLACEHOLDER)) out.add(m[1])
  return [...out]
}

/** Substitute every <<field>> with the row's value (missing/null → empty string). */
export function renderTemplate(text: string, row: Record<string, unknown>): string {
  return text.replace(PLACEHOLDER, (_full, key: string) => {
    const v = row[key]
    return v == null ? '' : String(v)
  })
}

/** Placeholders used in the text that have no matching field (so they'd render blank). */
export function missingPlaceholders(text: string, fields: string[]): string[] {
  const set = new Set(fields)
  return extractPlaceholders(text).filter((p) => !set.has(p))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = (s: string): boolean => EMAIL_RE.test(s.trim())

/** Distinct, valid, lowercased recipient emails from rows[recipientField]. */
export function resolveRecipients(
  rows: Record<string, unknown>[],
  recipientField: string,
): { valid: string[]; skipped: number } {
  const seen = new Set<string>()
  let skipped = 0
  for (const row of rows) {
    const to = String(row[recipientField] ?? '').trim().toLowerCase()
    if (!isEmail(to) || seen.has(to)) {
      skipped++
      continue
    }
    seen.add(to)
  }
  return { valid: [...seen], skipped }
}
