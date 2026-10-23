import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/manual-adjustments?riderId=...&type=...&category=...
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const riderId = searchParams.get('riderId')
  const type = searchParams.get('type')
  const category = searchParams.get('category')
  const status = searchParams.get('status') ?? 'active'

  const where: any = {}
  if (riderId) where.riderId = riderId
  if (type) where.type = type
  if (category) where.category = category
  if (status && status !== 'all') where.status = status

  const adjustments = await db.manualAdjustment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  // Aggregate by rider
  const byRider = new Map<string, { riderId: string; bonusTotal: number; deductionTotal: number; count: number }>()
  for (const a of adjustments) {
    if (a.status !== 'active') continue
    let d = byRider.get(a.riderId)
    if (!d) {
      d = { riderId: a.riderId, bonusTotal: 0, deductionTotal: 0, count: 0 }
      byRider.set(a.riderId, d)
    }
    if (a.type === 'bonus') d.bonusTotal += a.amount
    else d.deductionTotal += a.amount
    d.count += 1
  }

  // Aggregate by type
  const totalBonus = adjustments.filter(a => a.type === 'bonus' && a.status === 'active').reduce((a, x) => a + x.amount, 0)
  const totalDeduction = adjustments.filter(a => a.type === 'deduction' && a.status === 'active').reduce((a, x) => a + x.amount, 0)

  return NextResponse.json({
    adjustments,
    byRider: Array.from(byRider.values()),
    totalBonus,
    totalDeduction,
    count: adjustments.length,
  })
}

// POST /api/manual-adjustments — create new
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const body = await req.json()
  const { riderId, title, titleAr, amount, type, category, notes } = body

  if (!riderId || !title || amount === undefined || !type) {
    return NextResponse.json({ error: 'riderId, title, amount, type required' }, { status: 400 })
  }

  const driver = await db.driver.findUnique({ where: { riderId: String(riderId) } })
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const adj = await db.manualAdjustment.create({
    data: {
      driverId: driver.id,
      riderId: String(riderId),
      title,
      titleAr: titleAr || null,
      amount: parseFloat(amount),
      type, // 'bonus' | 'deduction'
      category: category || 'custom',
      status: 'active',
      notes: notes || null,
    },
  })

  await db.auditLog.create({
    data: {
      action: 'manual_adjustment_create',
      entityType: 'manual_adjustment',
      entityId: adj.id,
      description: `Added ${type} "${title}" SAR ${amount} for rider ${riderId}`,
      metadata: JSON.stringify({ amount, type, title, category }),
    },
  })

  return NextResponse.json({ adjustment: adj })
}

// PUT /api/manual-adjustments — update
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const adj = await db.manualAdjustment.update({
    where: { id },
    data: {
      title: updates.title,
      titleAr: updates.titleAr,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
      type: updates.type,
      category: updates.category,
      status: updates.status,
      notes: updates.notes,
    },
  })
  return NextResponse.json({ adjustment: adj })
}

// DELETE
export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.manualAdjustment.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
