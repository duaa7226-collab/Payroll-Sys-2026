import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/payslip?resultId=...
export async function GET(req: NextRequest) {
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

  const penalties = JSON.parse(result.penaltiesJson || '{}')

  return NextResponse.json({
    result,
    driver,
    company,
    traffic,
    penalties,
  })
}
