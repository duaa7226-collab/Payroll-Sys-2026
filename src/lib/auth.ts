// Server-side authorization guard for API routes.
//
// Authorization is enforced here (trusted server code) and in the database
// (RLS policies in prisma/migrations/*_auth_rls). The UI never decides access.
//
// Roles (single-organization model):
//   owner  — full control, including user management
//   admin  — read/write all payroll data
//   viewer — read-only
import { NextResponse } from 'next/server'
import { getSupabaseServerClient, SUPABASE_ENV_CONFIGURED } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export type AppRole = 'owner' | 'admin' | 'viewer'

export interface AuthContext {
  userId: string
  email: string
  role: AppRole
}

function unauthenticated(reason: string, status = 401): NextResponse {
  return NextResponse.json({ error: reason }, { status })
}

/**
 * Verify the request's Supabase session and load the caller's app role.
 * Returns either an AuthContext (authorized) or a NextResponse that the
 * route MUST return immediately.
 *
 * opts.write: also require role 'owner' or 'admin' (viewer is read-only).
 */
export async function requireAuth(opts?: { write?: boolean }): Promise<AuthContext | NextResponse> {
  if (!SUPABASE_ENV_CONFIGURED) {
    return unauthenticated(
      'Authentication is not configured on this deployment (missing Supabase environment variables).',
      503
    )
  }

  try {
    const supabase = getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return unauthenticated('Not signed in.')
    }

    const appUser = await db.appUser.findUnique({
      where: { id: user.id },
      select: { email: true, role: true, isActive: true },
    })

    if (!appUser || !appUser.isActive) {
      // Signed in to Supabase but not provisioned for this organization.
      return unauthenticated('Your account is not authorized for this organization.', 403)
    }

    const role = appUser.role as AppRole

    if (opts?.write && role === 'viewer') {
      return unauthenticated('Your role does not permit this operation.', 403)
    }

    return { userId: user.id, email: appUser.email || user.email || '', role }
  } catch (err) {
    console.error('[auth] authorization check failed:', err)
    // Do not fail open on internal errors (e.g. DB unreachable).
    return unauthenticated('Authorization check failed. Please try again.', 503)
  }
}
