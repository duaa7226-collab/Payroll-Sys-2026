import { DEFAULT_BRANDING, type Branding } from '@/lib/branding'
import { LoginView } from './login-view'

// Branding is database-backed, so this route must never be statically cached.
export const dynamic = 'force-dynamic'

// Server-side load so the uploaded logo is present on first paint (no flash of
// default branding). Falls back to the built-in defaults if the database is
// unreachable or not configured yet.
async function loadBranding(): Promise<Branding> {
  try {
    const { db } = await import('@/lib/db')
    const profile = await db.companyProfile.findFirst({
      select: { name: true, nameAr: true, logo: true },
    })
    if (!profile) return DEFAULT_BRANDING
    return {
      name: profile.name || DEFAULT_BRANDING.name,
      nameAr: profile.nameAr || DEFAULT_BRANDING.nameAr,
      logo: profile.logo || null,
    }
  } catch {
    return DEFAULT_BRANDING
  }
}

export default async function LoginPage() {
  const branding = await loadBranding()
  return <LoginView initialBranding={branding} />
}
