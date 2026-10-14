import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/expenses?month=2026-08
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const where: any = {}
    if (month) where.month = month
    const expenses = await db.expense.findMany({
      where,
      orderBy: [{ month: 'desc' }, { categoryName: 'asc' }],
    })
    return NextResponse.json({ expenses })
  } catch (err: any) {
    console.error('GET /api/income-expenses/expenses failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// POST — create expense
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, categoryId, amount, allocationType, assignedRiderId, notes } = body
    if (!month || !categoryId || amount === undefined) {
      return NextResponse.json({ error: 'month, categoryId, amount required' }, { status: 400 })
    }

    const cat = await db.expenseCategory.findUnique({ where: { id: categoryId } })
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    const expense = await db.expense.create({
      data: {
        month,
        categoryId,
        categoryName: cat.name,
        amount: Number(amount),
        allocationType: allocationType || cat.allocationType,
        assignedRiderId: assignedRiderId || null,
        notes: notes || null,
        createdBy: 'admin',
      },
    })
    await db.auditLog.create({
      data: {
        action: 'expense_create',
        entityType: 'expense',
        entityId: expense.id,
        description: `Created expense ${cat.name} SAR ${amount} for ${month}`,
        metadata: JSON.stringify({ month, categoryId, amount, allocationType }),
      },
    })
    return NextResponse.json({ expense })
  } catch (err: any) {
    console.error('POST /api/income-expenses/expenses failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// PUT — update
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const data: any = {}
    if (updates.amount !== undefined) data.amount = Number(updates.amount)
    if (updates.allocationType) data.allocationType = updates.allocationType
    if (updates.assignedRiderId !== undefined) data.assignedRiderId = updates.assignedRiderId || null
    if (updates.notes !== undefined) data.notes = updates.notes
    if (updates.categoryId) {
      const cat = await db.expenseCategory.findUnique({ where: { id: updates.categoryId } })
      if (cat) { data.categoryId = cat.id; data.categoryName = cat.name }
    }
    const expense = await db.expense.update({ where: { id }, data })
    return NextResponse.json({ expense })
  } catch (err: any) {
    console.error('PUT /api/income-expenses/expenses failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// DELETE
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await db.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/income-expenses/expenses failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
