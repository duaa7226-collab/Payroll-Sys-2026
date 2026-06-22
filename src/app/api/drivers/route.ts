import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/drivers?runId=...&search=...&sort=...&band=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')
  const search = searchParams.get('search') ?? ''
  const sort = searchParams.get('sort') ?? 'net_desc'
  const band = searchParams.get('band') ?? ''
  const reviewStatus = searchParams.get('review') ?? ''

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 })
  }

  let results = await db.driverResult.findMany({
    where: { payrollRunId: runId },
  })

  // Filter
  if (search) {
    const q = search.toLowerCase()
    results = results.filter(r =>
      r.driverName.toLowerCase().includes(q) ||
      r.riderId.toLowerCase().includes(q) ||
      r.contractName.toLowerCase().includes(q)
    )
  }
  if (band) results = results.filter(r => r.performanceBand === band)
  if (reviewStatus) results = results.filter(r => r.reviewStatus === reviewStatus)

  // Sort
  switch (sort) {
    case 'net_desc': results.sort((a, b) => b.finalNetSalary - a.finalNetSalary); break
    case 'net_asc': results.sort((a, b) => a.finalNetSalary - b.finalNetSalary); break
    case 'orders_desc': results.sort((a, b) => b.completedOrders - a.completedOrders); break
    case 'orders_asc': results.sort((a, b) => a.completedOrders - b.completedOrders); break
    case 'penalty_desc': results.sort((a, b) => b.totalOtherPenalties - a.totalOtherPenalties); break
    case 'name_asc': results.sort((a, b) => a.driverName.localeCompare(b.driverName)); break
  }

  return NextResponse.json({ results })
}
