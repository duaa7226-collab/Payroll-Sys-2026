import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/exceptions?runId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')

    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 })
    }

    const exceptions = await db.payrollException.findMany({
      where: { payrollRunId: runId },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    })

    const bySeverity = {
      error: exceptions.filter(e => e.severity === 'error').length,
      warning: exceptions.filter(e => e.severity === 'warning').length,
      info: exceptions.filter(e => e.severity === 'info').length,
    }

    return NextResponse.json({ exceptions, bySeverity })
  } catch (err: any) {
    console.error('GET /api/exceptions failed:', err)
    return NextResponse.json(
      { error: 'Failed to load exceptions', message: err?.message ?? 'Unknown error', exceptions: [], bySeverity: { error: 0, warning: 0, info: 0 } },
      { status: 500 }
    )
  }
}
