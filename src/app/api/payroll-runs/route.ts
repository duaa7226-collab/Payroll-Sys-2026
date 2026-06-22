import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/payroll-runs — list all payroll runs
export async function GET() {
  const runs = await db.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      ruleSet: { select: { name: true, ruleMode: true } },
      _count: { select: { results: true, exceptions: true } },
    },
  })
  return NextResponse.json({ runs })
}
