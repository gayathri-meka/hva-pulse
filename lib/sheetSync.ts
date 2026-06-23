// One-way sync of an in-app table (the source of truth) INTO a Google Sheet,
// preserving any extra columns the team maintains manually in that sheet.
//
// How it stays non-destructive:
//   - Rows are matched by a KEY column (e.g. id / email).
//   - For an existing row we write ONLY the managed cells, one cell at a time —
//     never the whole row — so unmanaged columns (notes, status, etc.) are left
//     exactly as the team left them.
//   - A table row with no matching key is APPENDED; its unmanaged columns are
//     left blank for the team to fill.
//   - Rows in the sheet that are no longer in the table are NOT touched (no
//     deletes) — manual annotations are never lost.
//
// Reusable anywhere: pass the rows + a key + the managed column mapping.
//
//   await syncTableToSheet({
//     spreadsheetId: process.env.SOME_SHEET_ID!,
//     sheetName: 'Learners',
//     rows: learners,                 // source of truth (any object[])
//     keyHeader: 'Email',             // unique key column header in the sheet
//     key: (l) => l.email.toLowerCase(),
//     columns: [
//       { header: 'Name',   value: (l) => l.name },
//       { header: 'Status', value: (l) => l.status },
//     ],
//   })
//
// PREREQUISITE: share the target sheet with GOOGLE_SERVICE_ACCOUNT_EMAIL as an
// Editor (the service account writes as itself).

import { google } from 'googleapis'

export type ManagedColumn<T> = {
  /** Exact header text of this column in the sheet's first row. */
  header: string
  /** Value this column should hold for a given row (the table owns it). */
  value: (row: T) => string | number | boolean | null | undefined
}

export type SheetSyncConfig<T> = {
  /** Header of the unique key column used to match a table row to a sheet row. */
  keyHeader: string
  /** Key value for a row. Normalise here (e.g. lowercase) for stable matching. */
  key: (row: T) => string
  /** The columns the table owns. Only these cells are ever written. */
  columns: ManagedColumn<T>[]
  /** Append rows whose key isn't in the sheet yet. Default true. */
  addNewRows?: boolean
}

/** Result shape shared by productised "Sync to Sheets" server actions. */
export type SyncToSheetResult =
  | { ok: true; stats: { updated: number; added: number; unchanged: number } }
  | { ok: false; error: string }

export type SheetSyncPlan = {
  /** New full header row to write at A1, or null if the header is unchanged. */
  headerRow: string[] | null
  /** Individual managed-cell writes (A1 range → value). Unmanaged cells absent. */
  updates: { a1: string; value: string }[]
  /** New rows to append (sized to the final header width; blanks for unmanaged). */
  appends: string[][]
  stats: { updated: number; added: number; unchanged: number }
}

const toStr = (v: unknown): string => (v == null ? '' : String(v))
const normKey = (s: string): string => s.trim()

/** Column index (0-based) → A1 letters: 0→A, 25→Z, 26→AA. */
export function colToA1(idx: number): string {
  let n = idx
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

const quoteTab = (name: string) => `'${name.replace(/'/g, "''")}'`

/** Pull a spreadsheet ID out of a full Google Sheets URL (or a bare ID). */
export function parseSpreadsheetId(input: string): string | null {
  const s = (input ?? '').trim()
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s // looks like a bare ID
  return null
}

/**
 * Pure diff: given the sheet's current values, decide what to write. No I/O, so
 * it's fully unit-testable. `existing` is the raw `values` grid (row 0 = header).
 */
export function computeSheetSync<T>(
  sheetName: string,
  existing: string[][],
  rows: T[],
  config: SheetSyncConfig<T>,
): SheetSyncPlan {
  const addNewRows = config.addNewRows ?? true
  const managedHeaders = config.columns.map((c) => c.header)

  // Empty sheet (or no header) → initialise with our header + every row.
  if (!existing.length || !existing[0]?.length) {
    const headerRow = [config.keyHeader, ...managedHeaders]
    const appends = rows.map((r) => [config.key(r), ...config.columns.map((c) => toStr(c.value(r)))])
    return { headerRow, updates: [], appends, stats: { updated: 0, added: appends.length, unchanged: 0 } }
  }

  const header = existing[0].map((h) => toStr(h))
  const headerIndex = new Map<string, number>()
  header.forEach((h, i) => headerIndex.set(h.trim(), i))

  const keyIdx = headerIndex.get(config.keyHeader.trim())
  if (keyIdx === undefined) {
    throw new Error(`syncTableToSheet: key column "${config.keyHeader}" not found in sheet "${sheetName}" header`)
  }

  // Resolve (or plan to append) a column index for each managed column.
  let nextNewIdx = header.length
  const appendedHeaders: string[] = []
  const colIdx = config.columns.map((c) => {
    const found = headerIndex.get(c.header.trim())
    if (found !== undefined) return found
    appendedHeaders.push(c.header)
    return nextNewIdx++
  })
  const finalWidth = header.length + appendedHeaders.length
  const headerRow = appendedHeaders.length ? [...header, ...appendedHeaders] : null

  // Map existing keys → 1-based sheet row number + the row's current cells.
  const existingByKey = new Map<string, { rowNum: number; cells: string[] }>()
  for (let r = 1; r < existing.length; r++) {
    const cells = (existing[r] ?? []).map((c) => toStr(c))
    const k = normKey(cells[keyIdx] ?? '')
    if (k && !existingByKey.has(k)) existingByKey.set(k, { rowNum: r + 1, cells })
  }

  const updates: SheetSyncPlan['updates'] = []
  const appends: string[][] = []
  let updated = 0
  let unchanged = 0

  for (const row of rows) {
    const k = normKey(config.key(row))
    const hit = existingByKey.get(k)
    if (hit) {
      let rowChanged = false
      config.columns.forEach((c, i) => {
        const idx = colIdx[i]
        const next = toStr(c.value(row))
        const cur = hit.cells[idx] ?? ''
        if (next !== cur) {
          updates.push({ a1: `${quoteTab(sheetName)}!${colToA1(idx)}${hit.rowNum}`, value: next })
          rowChanged = true
        }
      })
      if (rowChanged) updated++
      else unchanged++
    } else if (addNewRows) {
      const arr = new Array(finalWidth).fill('')
      arr[keyIdx] = k
      config.columns.forEach((c, i) => { arr[colIdx[i]] = toStr(c.value(row)) })
      appends.push(arr)
    }
  }

  return { headerRow, updates, appends, stats: { updated, added: appends.length, unchanged } }
}

// ── I/O wrapper ─────────────────────────────────────────────────────────────

function makeWriteAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    // Read+write (the readonly scope in lib/google.ts can't write).
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

/** The title of the first tab in a spreadsheet — the default sync target. */
export async function getFirstTabName(spreadsheetId: string): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: makeWriteAuth() })
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' })
  return meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1'
}

export type SyncTableToSheetArgs<T> = SheetSyncConfig<T> & {
  spreadsheetId: string
  sheetName: string
  rows: T[]
  /**
   * How written values are interpreted. 'USER_ENTERED' (default) makes numbers/
   * dates real values; 'RAW' stores them as literal text (safe for arbitrary
   * strings, e.g. values that start with '=').
   */
  valueInputOption?: 'USER_ENTERED' | 'RAW'
}

/**
 * Sync `rows` into the given sheet tab, preserving unmanaged columns. Returns the
 * counts of what changed. Trigger it wherever the table changes (a server action
 * after a mutation, a manual "Sync to sheet" button, or a cron route).
 */
export async function syncTableToSheet<T>(args: SyncTableToSheetArgs<T>): Promise<SheetSyncPlan['stats']> {
  const { spreadsheetId, sheetName, rows, valueInputOption = 'USER_ENTERED', ...config } = args
  const sheets = google.sheets({ version: 'v4', auth: makeWriteAuth() })

  // UNFORMATTED so numbers compare cleanly against what we write back.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  const existing = (res.data.values ?? []) as string[][]

  const plan = computeSheetSync(sheetName, existing, rows, config)

  // 1) Header (new tab or newly-appended managed columns).
  if (plan.headerRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteTab(sheetName)}!A1`,
      valueInputOption,
      requestBody: { values: [plan.headerRow] },
    })
  }

  // 2) Managed-cell updates, chunked (only these cells are touched).
  const CHUNK = 500
  for (let i = 0; i < plan.updates.length; i += CHUNK) {
    const slice = plan.updates.slice(i, i + CHUNK)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption,
        data: slice.map((u) => ({ range: u.a1, values: [[u.value]] })),
      },
    })
  }

  // 3) Append new rows.
  if (plan.appends.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: quoteTab(sheetName),
      valueInputOption,
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: plan.appends },
    })
  }

  return plan.stats
}
