import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseStringArray } from '@/lib/utils'

export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const deductions = await db.customDeduction.findMany({ orderBy: { createdAt: 'desc' } })
  const result = deductions.map(d => ({
    ...d,
    targetRiderIds: parseStringArray(d.targetRiderIds),
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
  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const existing = await db.customDeduction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)
  const data: Record<string, any> = {}
  if (has('name')) data.name = String(body.name)
  if (has('nameAr')) data.nameAr = body.nameAr || null
  if (has('description')) data.description = body.description || null
  if (has('status')) data.status = body.status

  const totalAmount = has('amount') ? parseFloat(body.amount) : existing.amount
  if (!Number.isFinite(totalAmount)) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  if (has('amount')) data.amount = totalAmount

  // Never wipe rider targeting when only the status is toggled.
  const applyToAll = has('applyToAll') ? body.applyToAll === true : existing.applyToAll
  data.applyToAll = applyToAll
  if (applyToAll) data.targetRiderIds = null
  else if (has('targetRiderIds')) data.targetRiderIds = Array.isArray(body.targetRiderIds) ? JSON.stringify(body.targetRiderIds) : existing.targetRiderIds

  // Toggling the status must not silently cancel an installment plan either.
  const enableInstallment = has('installmentEnabled') ? body.installmentEnabled === true : existing.installmentEnabled
  const monthlyAmt = enableInstallment
    ? (body.installmentMonthlyAmount !== undefined
        ? parseFloat(body.installmentMonthlyAmount)
        : existing.installmentMonthlyAmount)
    : 0
  if (enableInstallment && (!Number.isFinite(monthlyAmt) || monthlyAmt <= 0)) {
    return NextResponse.json({ error: 'Monthly installment amount must be > 0' }, { status: 400 })
  }
  if (enableInstallment && monthlyAmt >= totalAmount) {
    return NextResponse.json({ error: 'Monthly installment must be less than total amount' }, { status: 400 })
  }

  let installmentStatus = existing.installmentStatus
  if (!enableInstallment) installmentStatus = 'none'
  else if (existing.installmentStatus === 'none') installmentStatus = 'active'

  const deduction = await db.customDeduction.update({
    where: { id },
    data: {
      ...data,
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
