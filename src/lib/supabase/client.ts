// Browser-side Supabase client (cookie-based sessions, no privileged keys).
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_ENV_CONFIGURED = Boolean(url && anonKey && !url.includes('<project-ref>'))

let cached: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!SUPABASE_ENV_CONFIGURED) {
    throw new Error(
      'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
    )
  }
  if (!cached) {
    cached = createBrowserClient(url!, anonKey!)
  }
  return cached
}
