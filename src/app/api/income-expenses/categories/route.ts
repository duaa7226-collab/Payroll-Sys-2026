import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/categories — list all expense categories
export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const categories = await db.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    return NextResponse.json({ categories })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// POST — create new category
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { name, nameAr, defaultAmount, allocationType, description } = body
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const cat = await db.expenseCategory.create({
      data: {
        name,
        nameAr: nameAr || null,
        defaultAmount: Number(defaultAmount) || 0,
        allocationType: allocationType || 'per_driver',
        description: description || null,
      },
    })
    return NextResponse.json({ category: cat })
  } catch (err: any) {
    console.error('POST categories failed:', err)
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// PUT — update
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const data: any = {}
    if (updates.name) data.name = updates.name
    if (updates.nameAr !== undefined) data.nameAr = updates.nameAr || null
    if (updates.defaultAmount !== undefined) data.defaultAmount = Number(updates.defaultAmount) || 0
    if (updates.allocationType) data.allocationType = updates.allocationType
    if (updates.description !== undefined) data.description = updates.description || null
    if (updates.isActive !== undefined) data.isActive = updates.isActive
    const cat = await db.expenseCategory.update({ where: { id }, data })
    return NextResponse.json({ category: cat })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await db.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
