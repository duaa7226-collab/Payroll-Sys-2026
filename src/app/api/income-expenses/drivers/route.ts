import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/drivers — returns all drivers for dropdowns
export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const drivers = await db.driver.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, riderId: true, name: true, contractName: true, vehicleType: true },
    })
    return NextResponse.json({ drivers })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
