import { google } from 'googleapis'

function makeAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

/** Returns the raw (un-normalised) header row and first `maxDataRows` data rows. */
export async function getSheetRaw(sheetId: string, tabName: string, maxDataRows = 3) {
  const sheets   = google.sheets({ version: 'v4', auth: makeAuth() })
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: tabName })
  const rows     = response.data.values ?? []
  return {
    headers:  (rows[0] ?? []) as string[],
    rows:     rows.slice(1, maxDataRows + 1) as string[][],
  }
}

export async function getSheetRows(sheetId: string, tabName: string): Promise<Record<string, string>[]> {
  const sheets = google.sheets({ version: 'v4', auth: makeAuth() })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,
  })

  const rows = response.data.values
  if (!rows || rows.length < 2) return []

  const headers = (rows[0] as string[]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  )
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((header, i) => {
      obj[header] = (row[i] as string) ?? ''
    })
    return obj
  })
}
