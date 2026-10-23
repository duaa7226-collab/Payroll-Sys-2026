import { NextResponse } from 'next/server'
import { getSupabaseServerClient, SUPABASE_ENV_CONFIGURED } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import type { AppRole } from '@/lib/auth'

export async function GET() {
  if (!SUPABASE_ENV_CONFIGURED) {
    return NextResponse.json(
      { user: null, configured: false },
      { status: 200 }
    )
  }

  const supabase = getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ user: null, configured: true }, { status: 200 })
  }

  const appUser = await db.appUser.findUnique({
    where: { id: user.id },
    select: { email: true, role: true, isActive: true },
  })

  if (!appUser || !appUser.isActive) {
    return NextResponse.json({ user: null, configured: true, unauthorized: true }, { status: 200 })
  }

  return NextResponse.json({
    configured: true,
    user: { id: user.id, email: appUser.email || user.email, role: appUser.role as AppRole },
  })
}
