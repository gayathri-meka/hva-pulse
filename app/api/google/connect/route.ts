import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildAuthUrl, oauthConfigured } from '@/lib/googleMail'

// Starts the Google OAuth connect flow for the shared email-sending account.
// Admin-only. Redirects to Google's consent screen.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)
  const { data: appUser } = await supabase.from('users').select('role').eq('email', user.email).maybeSingle()
  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.redirect(`${origin}/settings/email?error=forbidden`)
  }

  if (!oauthConfigured()) {
    return NextResponse.redirect(`${origin}/settings/email?error=not_configured`)
  }

  const redirectUri = `${origin}/api/google/callback`
  return NextResponse.redirect(buildAuthUrl(redirectUri))
}
