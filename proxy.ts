import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Expose the current path to server components (layouts read it via headers()).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const protectedPrefixes = ['/dashboard', '/learners', '/admissions', '/users', '/placements', '/learner', '/learner-view', '/settings', '/ask-pulse', '/alumni', '/learning', '/candidate', '/tools']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  // getUser() validates the JWT with Supabase and therefore makes a network
  // request. A transient DNS/socket failure used to escape from middleware and
  // turn an otherwise successful OAuth callback into Next's "fetch failed"
  // error page. Retry once, then fail closed with a useful login URL.
  let user = null
  let authUnavailable = false
  try {
    ;({ data: { user } } = await supabase.auth.getUser())
  } catch {
    try {
      await new Promise((resolve) => setTimeout(resolve, 150))
      ;({ data: { user } } = await supabase.auth.getUser())
    } catch (error) {
      authUnavailable = true
      console.error('[auth] Supabase user validation unavailable after retry', error)
    }
  }

  if (authUnavailable && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'auth_unavailable')
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/learners/:path*',
    '/admissions/:path*',
    '/users/:path*',
    '/placements/:path*',
    '/learner/:path*',
    '/learner-view/:path*',
    '/settings/:path*',
    '/ask-pulse/:path*',
    '/alumni/:path*',
    '/learning/:path*',
    '/candidate/:path*',
    '/tools/:path*',
    '/login',
  ],
}
