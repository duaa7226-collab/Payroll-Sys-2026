import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_BRANDING, type Branding } from '@/lib/branding'

// GET /api/branding — public, unauthenticated.
// The sign-in screen needs the company name + logo before a session exists,
// so this endpoint exposes only those three fields and never any contact,
// tax or banking data from CompanyProfile.
export async function GET() {
  let branding: Branding = DEFAULT_BRANDING

  try {
    const profile = await db.companyProfile.findFirst({
      select: { name: true, nameAr: true, logo: true },
    })
    if (profile) {
      branding = {
        name: profile.name || DEFAULT_BRANDING.name,
        nameAr: profile.nameAr || DEFAULT_BRANDING.nameAr,
        logo: profile.logo || null,
      }
    }
  } catch {
    // Database unreachable / not configured — the login screen still renders
    // with the default branding instead of showing an error state.
  }

  return NextResponse.json(
    { branding },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' } }
  )
}
