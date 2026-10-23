// Server-side Supabase client bound to the request cookies (App Router).
// Uses the anon key only — never the service-role key in application code.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_ENV_CONFIGURED = Boolean(
  url && anonKey && !url.includes('<project-ref>') && !String(anonKey).startsWith('<')
)

export function getSupabaseServerClient(): SupabaseClient {
  if (!SUPABASE_ENV_CONFIGURED) {
    throw new Error(
      'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy anon key).'
    )
  }
  // cookies() is async on Next 16 and request-scoped; one store per request path.
  const cookieStorePromise = cookies()
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStorePromise.then(store => store.getAll())
      },
      setAll(cookiesToSet) {
        try {
          cookieStorePromise.then(store => {
            cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options))
          })
        } catch {
          // Called from a Server Component render pass — safe to ignore because the
          // session-refresh middleware already refreshes cookies before navigation.
        }
      },
    },
  })
}
