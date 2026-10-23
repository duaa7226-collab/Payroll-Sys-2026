import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/payroll-runs — list all payroll runs
export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const runs = await db.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      ruleSet: { select: { name: true, ruleMode: true } },
      _count: { select: { results: true, exceptions: true } },
    },
  })
  return NextResponse.json({ runs })
}
