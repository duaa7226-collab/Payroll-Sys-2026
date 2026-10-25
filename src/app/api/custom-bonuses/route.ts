import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseStringArray } from '@/lib/utils'

export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const bonuses = await db.customBonus.findMany({ orderBy: { createdAt: 'desc' } })
  const result = bonuses.map(b => ({
    ...b,
    targetRiderIds: parseStringArray(b.targetRiderIds),
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
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.customBonus.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)
  const data: Record<string, any> = {}
  if (has('name')) data.name = String(body.name)
  if (has('nameAr')) data.nameAr = body.nameAr || null
  if (has('amount')) {
    const amount = parseFloat(body.amount)
    if (!Number.isFinite(amount)) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    data.amount = amount
  }
  if (has('type')) data.type = body.type
  if (has('description')) data.description = body.description || null
  if (has('status')) data.status = body.status

  // Never wipe rider targeting when only the status is toggled.
  const applyToAll = has('applyToAll') ? body.applyToAll === true : existing.applyToAll
  data.applyToAll = applyToAll
  if (applyToAll) data.targetRiderIds = null
  else if (has('targetRiderIds')) data.targetRiderIds = Array.isArray(body.targetRiderIds) ? JSON.stringify(body.targetRiderIds) : existing.targetRiderIds

  const bonus = await db.customBonus.update({ where: { id }, data })
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
