import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/traffic-violations
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  const where: any = {}
  if (status) where.status = status

  const violations = await db.trafficViolation.findMany({
    where,
    orderBy: { ticketDate: 'desc' },
  })
  // Aggregate by driver
  const byDriver = new Map<string, { riderId: string; total: number; count: number }>()
  for (const v of violations) {
    const d = byDriver.get(v.riderId) ?? { riderId: v.riderId, total: 0, count: 0 }
    d.total += v.amount
    d.count += 1
    byDriver.set(v.riderId, d)
  }

  return NextResponse.json({
    violations,
    byDriver: Array.from(byDriver.values()).sort((a, b) => b.total - a.total),
    total: violations.reduce((a, v) => a + v.amount, 0),
    approved: violations.filter(v => v.status === 'approved').reduce((a, v) => a + v.amount, 0),
  })
}

// POST /api/traffic-violations — create new violation
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { riderId, violationType, amount, ticketDate, ticketNumber, status, notes } = body

  if (!riderId || !violationType || amount === undefined) {
    return NextResponse.json({ error: 'riderId, violationType, amount required' }, { status: 400 })
  }

  const driver = await db.driver.findUnique({ where: { riderId: String(riderId) } })
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const v = await db.trafficViolation.create({
    data: {
      driverId: driver.id,
      riderId: String(riderId),
      violationType,
      amount: parseFloat(amount),
      ticketDate: ticketDate ? new Date(ticketDate) : new Date(),
      ticketNumber: ticketNumber || null,
      status: status || 'approved',
      notes: notes || null,
    },
  })

  await db.auditLog.create({
    data: {
      action: 'traffic_create',
      entityType: 'traffic_violation',
      entityId: v.id,
      description: `Added ${violationType} violation SAR ${amount} for rider ${riderId}`,
      metadata: JSON.stringify({ amount, type: violationType }),
    },
  })

  return NextResponse.json({ violation: v })
}

// PUT /api/traffic-violations — update violation
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const v = await db.trafficViolation.update({
    where: { id },
    data: {
      violationType: updates.violationType,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
      ticketDate: updates.ticketDate ? new Date(updates.ticketDate) : undefined,
      ticketNumber: updates.ticketNumber,
      status: updates.status,
      notes: updates.notes,
    },
  })
  return NextResponse.json({ violation: v })
}

// DELETE helper via POST with action=delete
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.trafficViolation.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
