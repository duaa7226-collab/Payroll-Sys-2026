import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const bonuses = await db.customBonus.findMany({ orderBy: { createdAt: 'desc' } })
  const result = bonuses.map(b => ({
    ...b,
    targetRiderIds: b.targetRiderIds ? JSON.parse(b.targetRiderIds) : [],
  }))
  const activeTotal = result.filter(b => b.status === 'active').reduce((a, b) => a + b.amount, 0)
  return NextResponse.json({ bonuses: result, activeCount: result.filter(b => b.status === 'active').length, activeTotal })
}

export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { name, nameAr, amount, type, description, applyToAll, targetRiderIds } = await req.json()
  if (!name || amount === undefined) return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
  const bonus = await db.customBonus.create({
    data: {
      name, nameAr: nameAr || null, amount: parseFloat(amount), type: type || 'fixed',
      description: description || null, status: 'active',
      applyToAll: applyToAll !== false,
      targetRiderIds: applyToAll === false && targetRiderIds ? JSON.stringify(targetRiderIds) : null,
    },
  })
  await db.auditLog.create({ data: { action: 'custom_bonus_create', entityType: 'custom_bonus', entityId: bonus.id, description: `Created bonus "${name}" SAR ${amount}${applyToAll === false ? ' (selected riders)' : ' (all riders)'}` } })
  return NextResponse.json({ bonus })
}

export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const bonus = await db.customBonus.update({
    where: { id },
    data: {
      name: updates.name, nameAr: updates.nameAr,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
      type: updates.type, description: updates.description, status: updates.status,
      applyToAll: updates.applyToAll,
      targetRiderIds: updates.targetRiderIds ? JSON.stringify(updates.targetRiderIds) : null,
    },
  })
  return NextResponse.json({ bonus })
}

export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customBonus.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
