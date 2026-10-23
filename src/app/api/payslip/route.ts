import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveCustomBonuses } from '@/lib/custom-bonus-helpers'
import { getActiveCustomDeductions } from '@/lib/custom-deduction-helpers'

// GET /api/payslip?resultId=...
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const resultId = searchParams.get('resultId')

  if (!resultId) {
    return NextResponse.json({ error: 'resultId required' }, { status: 400 })
  }

  const result = await db.driverResult.findUnique({ where: { id: resultId } })
  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 })

  const driver = await db.driver.findUnique({ where: { id: result.driverId } })
  const company = await db.companyProfile.findFirst()
  const traffic = await db.trafficViolation.findMany({
    where: { riderId: result.riderId, status: 'approved' },
    orderBy: { ticketDate: 'desc' },
  })
  const manualAdjustments = await db.manualAdjustment.findMany({
    where: { riderId: result.riderId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  const customBonuses = await getActiveCustomBonuses()
  const customDeductions = await getActiveCustomDeductions()

  const penalties = JSON.parse(result.penaltiesJson || '{}')

  return NextResponse.json({
    result,
    driver,
    company,
    traffic,
    penalties,
    manualAdjustments,
    customBonuses,
    customDeductions,
  })
}
