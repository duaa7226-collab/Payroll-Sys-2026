// Supabase auth callback: exchanges the PKCE code for a session and routes
// the user to their next destination. Recovery links land on /reset-password.
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const SAFE_NEXT = /^\/(?!\/)/ // must start with a single "/" (no protocol-relative redirects)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  const next = SAFE_NEXT.test(rawNext) ? rawNext : '/'

  if (code) {
    const supabase = getSupabaseServerClient()
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (err) {
      console.error('[auth/callback] code exchange failed:', err)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`)
}
