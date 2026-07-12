import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const deductions = await db.customDeduction.findMany({ orderBy: { createdAt: 'desc' } })
  const activeTotal = deductions.filter(d => d.status === 'active').reduce((a, d) => a + d.amount, 0)
  return NextResponse.json({ deductions, activeCount: deductions.filter(d => d.status === 'active').length, activeTotal })
}

export async function POST(req: NextRequest) {
  const { name, nameAr, amount, description } = await req.json()
  if (!name || amount === undefined) return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
  const deduction = await db.customDeduction.create({
    data: { name, nameAr: nameAr || null, amount: parseFloat(amount), description: description || null, status: 'active' },
  })
  await db.auditLog.create({ data: { action: 'custom_deduction_create', entityType: 'custom_deduction', entityId: deduction.id, description: `Created deduction "${name}" SAR ${amount}` } })
  return NextResponse.json({ deduction })
}

export async function PUT(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const deduction = await db.customDeduction.update({
    where: { id },
    data: { name: updates.name, nameAr: updates.nameAr, amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined, description: updates.description, status: updates.status },
  })
  return NextResponse.json({ deduction })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customDeduction.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
