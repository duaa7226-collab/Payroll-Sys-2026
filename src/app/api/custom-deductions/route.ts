import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const deductions = await db.customDeduction.findMany({ orderBy: { createdAt: 'desc' } })
  const result = deductions.map(d => ({
    ...d,
    targetRiderIds: d.targetRiderIds ? JSON.parse(d.targetRiderIds) : [],
    remainingBalance: d.installmentEnabled ? Math.max(0, d.amount - d.installmentTotalPaid) : d.amount,
    installmentRemainingMonths: d.installmentEnabled && d.installmentMonthlyAmount > 0
      ? Math.ceil(Math.max(0, d.amount - d.installmentTotalPaid) / d.installmentMonthlyAmount) : 0,
  }))
  const activeTotal = result.filter(d => d.status === 'active').reduce((a, d) => {
    // For installment deductions, use monthly amount; for one-time, use full amount
    if (d.installmentEnabled && d.installmentStatus === 'active') return a + d.installmentMonthlyAmount
    return a + d.amount
  }, 0)
  return NextResponse.json({ deductions: result, activeCount: result.filter(d => d.status === 'active').length, activeTotal })
}

export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { name, nameAr, amount, description, applyToAll, targetRiderIds, installmentEnabled, installmentMonthlyAmount } = await req.json()
  if (!name || amount === undefined) return NextResponse.json({ error: 'name and amount required' }, { status: 400 })

  const enableInstallment = installmentEnabled === true
  const monthlyAmt = enableInstallment ? parseFloat(installmentMonthlyAmount || 0) : 0
  if (enableInstallment && monthlyAmt <= 0) {
    return NextResponse.json({ error: 'Monthly installment amount must be > 0' }, { status: 400 })
  }
  if (enableInstallment && monthlyAmt >= parseFloat(amount)) {
    return NextResponse.json({ error: 'Monthly installment must be less than total amount' }, { status: 400 })
  }

  const deduction = await db.customDeduction.create({
    data: {
      name, nameAr: nameAr || null, amount: parseFloat(amount), description: description || null, status: 'active',
      applyToAll: applyToAll !== false,
      targetRiderIds: applyToAll === false && targetRiderIds ? JSON.stringify(targetRiderIds) : null,
      installmentEnabled: enableInstallment,
      installmentMonthlyAmount: monthlyAmt,
      installmentTotalPaid: 0,
      installmentStatus: enableInstallment ? 'active' : 'none',
    },
  })
  await db.auditLog.create({ data: { action: 'custom_deduction_create', entityType: 'custom_deduction', entityId: deduction.id, description: `Created deduction "${name}" SAR ${amount}${enableInstallment ? ` (installment: SAR ${monthlyAmt}/month)` : ''}` } })
  return NextResponse.json({ deduction })
}

export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await db.customDeduction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const enableInstallment = updates.installmentEnabled === true
  const monthlyAmt = enableInstallment ? parseFloat(updates.installmentMonthlyAmount || 0) : 0
  let installmentStatus = existing.installmentStatus
  if (enableInstallment && existing.installmentStatus !== 'completed') installmentStatus = 'active'
  else if (!enableInstallment) installmentStatus = 'none'

  const deduction = await db.customDeduction.update({
    where: { id },
    data: {
      name: updates.name, nameAr: updates.nameAr,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : undefined,
      description: updates.description, status: updates.status,
      applyToAll: updates.applyToAll,
      targetRiderIds: updates.targetRiderIds ? JSON.stringify(updates.targetRiderIds) : null,
      installmentEnabled: enableInstallment,
      installmentMonthlyAmount: monthlyAmt,
      installmentStatus,
    },
  })
  return NextResponse.json({ deduction })
}

export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customDeduction.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
