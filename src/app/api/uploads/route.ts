import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/uploads?limit=50&month=May%202026
// Upload history — metadata only; the file itself is streamed by
// /api/uploads/[id]. Files stay here until a user explicitly deletes them.
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')?.trim()
  const requestedLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50

  const where = month ? { payrollMonth: month } : {}

  try {
    const [uploads, total, sum] = await Promise.all([
      db.uploadedFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
          payrollMonth: true,
          driverCount: true,
          uploadedBy: true,
          payrollRunId: true,
          createdAt: true,
        },
      }),
      db.uploadedFile.count({ where }),
      db.uploadedFile.aggregate({ where, _sum: { size: true } }),
    ])

    return NextResponse.json({
      uploads,
      total,
      totalBytes: sum._sum.size ?? 0,
    })
  } catch (err: any) {
    console.error('GET /api/uploads failed:', err)
    // Table missing (migration not applied yet) — return an empty archive
    // instead of breaking the dashboard.
    return NextResponse.json({ uploads: [], total: 0, totalBytes: 0, error: 'Upload history is unavailable', message: err?.message }, { status: 200 })
  }
}
