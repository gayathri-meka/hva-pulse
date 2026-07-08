import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exchangeCode, emailFromIdToken, storeCredential } from '@/lib/googleMail'

// OAuth callback for the shared email-sending account. Exchanges the code for
// tokens, records the refresh token + connected account, and returns to Settings.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const settings = `${origin}/settings/email`

  const err = searchParams.get('error')
  if (err) return NextResponse.redirect(`${settings}?error=${encodeURIComponent(err)}`)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(`${settings}?error=no_code`)

  // Only an admin can complete the connect.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)
  const { data: appUser } = await supabase.from('users').select('role, name').eq('email', user.email).maybeSingle()
  if (!appUser || appUser.role !== 'admin') return NextResponse.redirect(`${settings}?error=forbidden`)

  const tokens = await exchangeCode(code, `${origin}/api/google/callback`)
  if (!tokens.refresh_token) {
    // No refresh token — usually means the account was already consented without
    // prompt=consent. Our connect flow forces prompt=consent, so surface the error.
    return NextResponse.redirect(`${settings}?error=${encodeURIComponent(tokens.error || 'no_refresh_token')}`)
  }

  const email = emailFromIdToken(tokens.id_token)
  if (!email) return NextResponse.redirect(`${settings}?error=no_email`)

  const { data: dbUser } = await supabase.from('users').select('id').eq('email', user.email).maybeSingle()
  await storeCredential({
    email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in,
    connectedBy: dbUser?.id ?? null,
    connectedByName: appUser.name ?? null,
  })

  return NextResponse.redirect(`${settings}?connected=1`)
}
