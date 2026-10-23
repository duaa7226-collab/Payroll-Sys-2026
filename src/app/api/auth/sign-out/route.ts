import { NextResponse } from 'next/server'
import { getSupabaseServerClient, SUPABASE_ENV_CONFIGURED } from '@/lib/supabase/server'

export async function POST() {
  if (!SUPABASE_ENV_CONFIGURED) {
    // Nothing to clear client-side cookies without the Supabase env config.
    return NextResponse.json({ ok: true })
  }
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('[auth] sign-out failed:', error.message)
    return NextResponse.json({ error: 'Sign out failed. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
