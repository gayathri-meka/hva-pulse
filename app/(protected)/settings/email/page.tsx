import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { getConnectedAccount, oauthConfigured } from '@/lib/googleMail'
import DisconnectButton from './DisconnectButton'

export const dynamic = 'force-dynamic'

const ERROR_LABELS: Record<string, string> = {
  forbidden: 'You need to be an admin to connect the email account.',
  not_configured: 'Google OAuth isn’t configured — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.',
  no_code: 'Google didn’t return an authorization code. Please try again.',
  no_email: 'Couldn’t read the account email from Google. Please try again.',
  no_refresh_token: 'Google didn’t return a refresh token. Remove Pulse from your Google account’s third-party access and reconnect.',
}

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role === 'learner') redirect('/dashboard')

  const { connected, error } = await searchParams
  const account = await getConnectedAccount()
  const configured = oauthConfigured()
  const isAdmin = appUser.role === 'admin'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Email</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connect the Google account that sends email campaigns (mail-merge on Admissions).
        </p>
      </div>

      {connected && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          Google account connected — campaigns will send from it.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {ERROR_LABELS[error] ?? `Couldn’t connect: ${error}`}
        </div>
      )}

      {!configured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Google OAuth isn’t configured yet. Add <code className="rounded bg-amber-100 px-1">GOOGLE_OAUTH_CLIENT_ID</code> and{' '}
          <code className="rounded bg-amber-100 px-1">GOOGLE_OAUTH_CLIENT_SECRET</code> (and register the redirect URI
          <code className="rounded bg-amber-100 px-1">/api/google/callback</code>) before connecting.
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        {account ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <h2 className="text-base font-semibold text-zinc-900">Connected</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-700">{account.email}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Connected{account.connectedByName ? ` by ${account.connectedByName}` : ''} ·{' '}
                {new Date(account.connectedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href="/api/google/connect"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Reconnect
                </a>
                <DisconnectButton />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">No account connected</h2>
              <p className="mt-1 text-sm text-zinc-500">Campaigns can’t send until a Google account is connected.</p>
            </div>
            {isAdmin && configured && (
              <a
                href="/api/google/connect"
                className="shrink-0 rounded-lg bg-[#5BAE5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e9c4e]"
              >
                Connect Google account
              </a>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Emails send via the Gmail API as the connected account. Gmail caps sending at roughly 2,000 recipients/day on
        Workspace, so very large campaigns should be split across days.
      </p>
    </div>
  )
}
