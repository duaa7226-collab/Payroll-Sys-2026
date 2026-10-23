// Browser-side Supabase client (cookie-based sessions, no privileged keys).
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_ENV_CONFIGURED = Boolean(url && anonKey && !url.includes('<project-ref>'))

let cached: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!SUPABASE_ENV_CONFIGURED) {
    throw new Error(
      'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy anon key).'
    )
  }
  if (!cached) {
    cached = createBrowserClient(url!, anonKey!)
  }
  return cached
}
