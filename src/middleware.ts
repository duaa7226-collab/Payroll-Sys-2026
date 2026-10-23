// Session refresh + route protection.
// Refreshes Supabase auth cookies on every navigation and gates all app pages
// and API routes behind a valid session. Handlers still verify roles per-request.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set([
  '/login',
  '/reset-password',
  '/auth/callback',
  '/auth/signout',
])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return pathname.startsWith('/api/auth/') || pathname.startsWith('/_next/')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configured = Boolean(
    url && anonKey && !url.includes('<project-ref>') && !String(anonKey).startsWith('<')
  )

  if (!configured) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication is not configured on this deployment (missing Supabase env vars).' },
        { status: 503 }
      )
    }
    // Public auth pages stay reachable so the user sees the configuration notice.
    if (PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next()
    }
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/login'
    redirect.searchParams.set('reason', 'not-configured')
    return NextResponse.redirect(redirect)
  }

  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANT: do not remove — invoking getUser() refreshes the auth session cookies.
  const { data: { user } } = await supabase.auth.getUser()

  if (!isPublicPath(pathname) && !pathname.startsWith('/api/') && !user) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/login'
    redirect.searchParams.set('next', pathname)
    return NextResponse.redirect(redirect)
  }

  if (pathname === '/login' && user) {
    const redirect = request.nextUrl.clone()
    redirect.pathname = '/'
    redirect.search = ''
    return NextResponse.redirect(redirect)
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
