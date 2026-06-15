import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) return NextResponse.redirect(`${origin}/login`)

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login`)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.redirect(`${origin}/login`)

  const email = user.email.toLowerCase()

  // Marketing-form attribution token forwarded from /login via redirectTo.
  // Opaque UUID v4 (~36 chars); cap length defensively, treat empty as absent.
  const rawToken = searchParams.get('signup_token')?.trim() ?? ''
  const signupToken = rawToken && rawToken.length <= 100 ? rawToken : null

  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (appUser) {
    // Existing staff/learner. A tokened link isn't meaningful here (the token
    // is for new prospect signups) — log it and proceed without storing.
    if (signupToken) {
      console.warn(`[signup_token] tokened link used by existing app user ${email}; ignoring token`)
    }
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Unrecognised email — capture as prospect and route to the holding screen.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    null
  const avatarUrl =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture) ||
    null

  const now = new Date().toISOString()

  // Read the prior token first so we can tell a genuine new association from a
  // returning login (and detect mismatches) before the upsert refreshes the row.
  const { data: prior } = await admin
    .from('prospects')
    .select('signup_token')
    .eq('email', email)
    .maybeSingle()

  await admin
    .from('prospects')
    .upsert(
      { email, name, avatar_url: avatarUrl, last_seen_at: now },
      { onConflict: 'email' },
    )

  if (signupToken) {
    if (!prior?.signup_token) {
      // First time we're associating a token with this prospect. The
      // .is('signup_token', null) guard makes this a no-op (race-safe) if a
      // concurrent request already set one — we never overwrite a token.
      await admin
        .from('prospects')
        .update({ signup_token: signupToken })
        .eq('email', email)
        .is('signup_token', null)

      // Write-back to the form row so the admin/analytics side knows this
      // submission converted. Keep-first: only stamp an as-yet-unstamped row.
      await admin
        .from('learner_applications')
        .update({ signed_up_at: now })
        .eq('signup_token', signupToken)
        .is('signed_up_at', null)
    } else if (prior.signup_token !== signupToken) {
      console.warn(
        `[signup_token] ${email} already has token ${prior.signup_token}; ignoring incoming ${signupToken}`,
      )
    }
  }

  return NextResponse.redirect(`${origin}/candidate/welcome`)
}
