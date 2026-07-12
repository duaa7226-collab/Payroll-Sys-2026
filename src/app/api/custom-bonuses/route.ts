import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/custom-bonuses
export async function GET() {
  const bonuses = await db.customBonus.findMany({
    orderBy: { createdAt: 'desc' },
  })
  const activeTotal = bonuses.filter(b => b.status === 'active').reduce((a, b) => a + b.amount, 0)
  return NextResponse.json({ bonuses, activeCount: bonuses.filter(b => b.status === 'active').length, activeTotal })
}

// POST — create
export async function POST(req: NextRequest) {
  const { name, nameAr, amount, type, description } = await req.json()
  if (!name || amount === undefined) {
    return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
  }
  const bonus = await db.customBonus.create({
    data: { name, nameAr: nameAr || null, amount: parseFloat(amount), type: type || 'fixed', description: description || null, status: 'active' },
  })
  await db.auditLog.create({
    data: { action: 'custom_bonus_create', entityType: 'custom_bonus', entityId: bonus.id, description: `Created bonus "${name}" SAR ${amount}` },
  })
  return NextResponse.json({ bonus })
}

// PUT — update
export async function PUT(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const bonus = await db.customBonus.update({
    where: { id },
    data: {
      name: updates.name, nameAr: updates.nameAr,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
      type: updates.type, description: updates.description, status: updates.status,
    },
  })
  return NextResponse.json({ bonus })
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customBonus.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
