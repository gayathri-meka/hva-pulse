import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // Validate the session JWT locally when possible. Calling getUser() here
  // makes a network request for every matched page request, which can exhaust
  // Supabase Auth's request-rate limit during local development/HMR.
  let isAuthenticated = false
  try {
    const { data } = await supabase.auth.getClaims()
    isAuthenticated = Boolean(data?.claims?.sub)
  } catch (error) {
    // A transient Auth/network failure should behave like a missing session,
    // not crash the middleware and flood the dev console with rejected calls.
    console.error('Unable to validate Supabase session', error)
  }

  const protectedPrefixes = ['/dashboard', '/learners', '/admissions', '/users', '/placements', '/learner', '/learner-view', '/settings', '/ask-pulse', '/alumni', '/learning', '/candidate', '/tools', '/tickets']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (!isAuthenticated && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthenticated && pathname === '/login') {
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
    '/tickets/:path*',
    '/login',
  ],
}
