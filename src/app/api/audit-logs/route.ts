import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/audit-logs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '100')
  const action = searchParams.get('action')

  const where: any = {}
  if (action) where.action = action

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return NextResponse.json({ logs })
}
