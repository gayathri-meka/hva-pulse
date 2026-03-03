import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import SyncSheetButton from './SyncSheetButton'

export const dynamic = 'force-dynamic'

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

const SHEETS = [
  {
    key:         'learner_roster',
    name:        'Learner Roster',
    description: 'Core learner identity, batch, LF, track and join date.',
    tab:         'Learners',
    apiRoute:    '/api/sync',
  },
  {
    key:         'learner_info',
    name:        'Learner Info',
    description: 'Scores, skills, degree, location and readiness data.',
    tab:         'Learner info',
    apiRoute:    '/api/sync-learner-info',
  },
]

export default async function SheetsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()
  const { data: logs } = await supabase.from('sync_logs').select('*')

  const logMap = Object.fromEntries(
    (logs ?? []).map((l) => [l.sheet_key, l])
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Sheets</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage Google Sheet connections and trigger manual syncs.
        </p>
      </div>

      <div className="grid gap-4">
        {SHEETS.map((sheet) => {
          const log = logMap[sheet.key]
          return (
            <div
              key={sheet.key}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-500">
                      <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25l.01 9.5A2.25 2.25 0 0 1 16.76 17H3.26A2.25 2.25 0 0 1 1 14.74l-.01-9.5Zm8.26 9.52v-.001a.75.75 0 0 0 .75.75h5.5a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0-.75.75Zm0-4v-.001a.75.75 0 0 0 .75.75h5.5a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0-.75.75Zm-4.5 4a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm.75-4.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-base font-semibold text-zinc-900">{sheet.name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{sheet.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span>Tab: <span className="font-medium text-zinc-600">{sheet.tab}</span></span>
                    {log ? (
                      <>
                        <span>Last synced: <span className="font-medium text-zinc-600">{timeAgo(log.last_synced_at)}</span></span>
                        <span>Records: <span className="font-medium text-zinc-600">{log.records_synced}</span></span>
                      </>
                    ) : (
                      <span className="text-zinc-400">Never synced</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <SyncSheetButton apiRoute={sheet.apiRoute} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
