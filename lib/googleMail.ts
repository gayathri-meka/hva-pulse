// Gmail-based email sending for campaigns, using a single shared Google account
// connected via OAuth (see migrations/062). The refresh token is stored in
// email_oauth_credentials; we mint a short-lived access token per send batch and
// call the Gmail API directly over fetch (no SDK).
//
// Setup (one-time, in Google Cloud): create an OAuth 2.0 Web client, add the
// gmail.send + userinfo.email scopes to the consent screen, and register the
// redirect URI `<app-origin>/api/google/callback`. Put the client id/secret in
// GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET. An admin then connects the
// sending account under Settings → Email.

import { createClient } from '@supabase/supabase-js'

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  // Lets the shared account create the interview calendar event + Meet link.
  'https://www.googleapis.com/auth/calendar.events',
]

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export function oauthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
}

/** The Google consent URL to start the connect flow. */
export function buildAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',   // needed to receive a refresh token
    prompt: 'consent',        // force a refresh token even on re-consent
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  id_token?: string
  error?: string
  error_description?: string
}

/** Exchange an OAuth code for tokens (used by the callback route). */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  return (await res.json()) as TokenResponse
}

/** The connected account's email is inside the id_token JWT payload. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { email?: string }
    return payload.email?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export async function storeCredential(row: {
  email: string
  refreshToken: string
  accessToken?: string | null
  expiresIn?: number | null
  connectedBy?: string | null
  connectedByName?: string | null
}) {
  const now = Date.now()
  await admin()
    .from('email_oauth_credentials')
    .upsert(
      {
        provider: 'google',
        email: row.email,
        refresh_token: row.refreshToken,
        access_token: row.accessToken ?? null,
        token_expiry: row.expiresIn ? new Date(now + row.expiresIn * 1000).toISOString() : null,
        connected_by: row.connectedBy ?? null,
        connected_by_name: row.connectedByName ?? null,
        connected_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'provider' },
    )
}

export type ConnectedAccount = { email: string; connectedByName: string | null; connectedAt: string }

/** The connected sending account (for the settings UI), or null if none. */
export async function getConnectedAccount(): Promise<ConnectedAccount | null> {
  const { data } = await admin()
    .from('email_oauth_credentials')
    .select('email, connected_by_name, connected_at')
    .eq('provider', 'google')
    .maybeSingle()
  if (!data) return null
  return { email: data.email, connectedByName: data.connected_by_name, connectedAt: data.connected_at }
}

export async function disconnectAccount() {
  await admin().from('email_oauth_credentials').delete().eq('provider', 'google')
}

/** A ready-to-send Gmail sender: a fresh access token + the From address. */
export type GmailSender = { accessToken: string; from: string }

/**
 * Load the shared credential and return a valid access token + From address.
 * Refreshes the access token from the refresh token every time (simplest correct
 * behaviour). Returns null if OAuth isn't configured or no account is connected.
 */
export async function getGmailSender(): Promise<GmailSender | null> {
  const t = await getGoogleAccessToken()
  if (!t) return null
  const displayName = process.env.EMAIL_FROM_NAME || 'HyperVerge Academy'
  return { accessToken: t.accessToken, from: `${encodeHeaderWord(displayName)} <${t.email}>` }
}

/**
 * Mint a fresh access token for the shared Google account (+ its email). Used by
 * both the Gmail sender and the Calendar helper. Null if OAuth isn't configured or
 * no account is connected.
 */
export async function getGoogleAccessToken(): Promise<{ accessToken: string; email: string } | null> {
  if (!oauthConfigured()) return null
  const { data } = await admin()
    .from('email_oauth_credentials')
    .select('email, refresh_token')
    .eq('provider', 'google')
    .maybeSingle()
  if (!data?.refresh_token) return null

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const tok = (await res.json()) as TokenResponse
  if (!tok.access_token) return null
  return { accessToken: tok.access_token, email: data.email }
}

// RFC 2047 encode a header value if it contains non-ASCII (Subject / display name).
function encodeHeaderWord(s: string): string {
  return /[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s
}

/** Build a base64url-encoded RFC 2822 message for the Gmail send API. Pure. */
export function buildRawMessage(opts: {
  from: string
  to: string
  subject: string
  text: string
  replyTo?: string
}): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encodeHeaderWord(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean)
  const body = Buffer.from(opts.text, 'utf8').toString('base64')
  const message = `${headers.join('\r\n')}\r\n\r\n${body}`
  return Buffer.from(message, 'utf8').toString('base64url')
}

/** Send one raw message via the Gmail API. */
export async function sendRaw(accessToken: string, raw: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(SEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    if (!res.ok) return { ok: false, error: `Gmail ${res.status}: ${(await res.text()).slice(0, 200)}` }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data?.id }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) }
  }
}
