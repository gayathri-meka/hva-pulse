import { google } from 'googleapis'

export async function getSheetRows(): Promise<Record<string, string>[]> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'Learners',
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
