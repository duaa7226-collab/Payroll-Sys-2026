import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/driver-count?month=2026-08
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month) {
      const all = await db.driverCount.findMany({ orderBy: { month: 'desc' } })
      return NextResponse.json({ counts: all })
    }
    const dc = await db.driverCount.findUnique({ where: { month } })
    return NextResponse.json({ driverCount: dc })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// POST — set driver count for a month
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, activeDriverCount, notes, confirm } = body
    if (!month || activeDriverCount === undefined) {
      return NextResponse.json({ error: 'month and activeDriverCount required' }, { status: 400 })
    }
    const count = parseInt(activeDriverCount, 10)
    if (count < 0) return NextResponse.json({ error: 'Count must be >= 0' }, { status: 400 })
    if (count === 0) return NextResponse.json({ error: 'Driver count cannot be zero (would cause division by zero in shared allocations)' }, { status: 400 })

    // Check existing
    const existing = await db.driverCount.findUnique({ where: { month } })
    if (existing && existing.activeDriverCount !== count && !confirm) {
      return NextResponse.json({
        error: 'Driver count changed',
        message: `Driver count for ${month} is currently ${existing.activeDriverCount}. Changing to ${count} will recalculate shared allocations for ${month} only. Set confirm=true to proceed.`,
        oldCount: existing.activeDriverCount,
        newCount: count,
      }, { status: 409 })
    }

    const dc = await db.driverCount.upsert({
      where: { month },
      create: { month, activeDriverCount: count, notes, confirmedBy: 'admin' },
      update: { activeDriverCount: count, notes, confirmedBy: 'admin' },
    })
    await db.auditLog.create({
      data: {
        action: 'driver_count_set',
        entityType: 'driver_count',
        entityId: dc.id,
        description: `Set driver count for ${month} to ${count}`,
        metadata: JSON.stringify({ month, count }),
      },
    })
    return NextResponse.json({ driverCount: dc })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
