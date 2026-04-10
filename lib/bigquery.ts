import { google } from 'googleapis'

function makeBqAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/bigquery'],
  })
}

type BqRow = Record<string, string | null>

/** Runs a BigQuery SQL query and returns all rows with field-name keys. */
export async function runBigQuery(projectId: string, query: string): Promise<BqRow[]> {
  const bq = google.bigquery({ version: 'v2', auth: makeBqAuth() })

  // Insert async job
  const { data: job } = await bq.jobs.insert({
    projectId,
    requestBody: {
      configuration: { query: { query, useLegacySql: false } },
    },
  })

  const jobId = job.jobReference!.jobId!

  // Poll until complete
  for (;;) {
    const { data: status } = await bq.jobs.get({ projectId, jobId })
    if (status.status?.state === 'DONE') {
      if (status.status.errorResult) {
        throw new Error(status.status.errorResult.message ?? 'BigQuery job failed')
      }
      break
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  // Paginate through all result pages
  const results: BqRow[] = []
  let pageToken: string | undefined

  do {
    const { data } = await bq.jobs.getQueryResults({
      projectId,
      jobId,
      maxResults: 10000,
      pageToken,
    })
    const fields = data.schema?.fields ?? []
    for (const row of data.rows ?? []) {
      const obj: BqRow = {}
      fields.forEach((f, i) => {
        obj[f.name!] = (row.f?.[i]?.v as string | null) ?? null
      })
      results.push(obj)
    }
    pageToken = data.pageToken ?? undefined
  } while (pageToken)

  return results
}
