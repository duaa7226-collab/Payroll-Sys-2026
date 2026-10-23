import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient, SUPABASE_ENV_CONFIGURED } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import type { AppRole } from '@/lib/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  if (!SUPABASE_ENV_CONFIGURED) {
    return NextResponse.json(
      { error: 'Authentication is not configured on this deployment (missing Supabase environment variables).' },
      { status: 503 }
    )
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (password.length === 0) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  }
  if (password.length > 200) {
    return NextResponse.json({ error: 'Password is too long.' }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Keep the message generic: never reveal whether the account exists.
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  // Enforce organization membership server-side: a valid Supabase session is
  // not enough — the caller must be provisioned in app_user.
  const appUser = await db.appUser.findUnique({
    where: { id: data.user.id },
    select: { email: true, role: true, isActive: true },
  })

  if (!appUser || !appUser.isActive) {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: 'Your account is not authorized for this organization. Contact an administrator.' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    user: { id: data.user.id, email: appUser.email || data.user.email, role: appUser.role as AppRole },
  })
}
