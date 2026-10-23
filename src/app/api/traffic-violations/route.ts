import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/traffic-violations
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''

    const where: any = {}
    if (status) where.status = status

    const violations = await db.trafficViolation.findMany({
      where,
      orderBy: { ticketDate: 'desc' },
    })

    // Compute installment progress + monthly deduction for display
    const enriched = violations.map(v => {
      const remaining = v.installmentEnabled ? Math.max(0, v.amount - v.installmentTotalPaid) : 0
      const monthlyDeduction = v.installmentEnabled && v.installmentStatus === 'active'
        ? Math.min(v.installmentMonthlyAmount, remaining)
        : 0
      const remainingMonths = monthlyDeduction > 0 ? Math.ceil(remaining / monthlyDeduction) : 0
      return {
        ...v,
        remainingBalance: v.installmentEnabled ? remaining : v.amount,
        monthlyDeduction,
        installmentRemainingMonths: remainingMonths,
      }
    })

    // Aggregate by driver
    const byDriver = new Map<string, { riderId: string; total: number; count: number }>()
    for (const v of enriched) {
      const d = byDriver.get(v.riderId) ?? { riderId: v.riderId, total: 0, count: 0 }
      d.total += v.installmentEnabled ? monthlyForAgg(v) : v.amount
      d.count += 1
      byDriver.set(v.riderId, d)
    }

    return NextResponse.json({
      violations: enriched,
      byDriver: Array.from(byDriver.values()).sort((a, b) => b.total - a.total),
      total: enriched.reduce((a, v) => a + (v.installmentEnabled ? monthlyForAgg(v) : v.amount), 0),
      approved: enriched.filter(v => v.status === 'approved').reduce((a, v) => a + (v.installmentEnabled ? monthlyForAgg(v) : v.amount), 0),
    })
  } catch (err: any) {
    console.error('GET /api/traffic-violations failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message, violations: [], byDriver: [], total: 0, approved: 0 }, { status: 500 })
  }
}

function monthlyForAgg(v: any): number {
  if (!v.installmentEnabled) return v.amount
  if (v.installmentStatus !== 'active') return 0
  const remaining = Math.max(0, v.amount - v.installmentTotalPaid)
  return Math.min(v.installmentMonthlyAmount, remaining)
}

// POST /api/traffic-violations — create new violation
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const {
      riderId, violationType, amount, ticketDate, ticketNumber, status, notes,
      installmentEnabled, installmentMonthlyAmount,
    } = body

    if (!riderId || !violationType || amount === undefined) {
      return NextResponse.json({ error: 'riderId, violationType, amount required' }, { status: 400 })
    }

    const driver = await db.driver.findUnique({ where: { riderId: String(riderId) } })
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    const totalAmount = parseFloat(amount)
    const isInstallment = !!installmentEnabled
    const monthly = isInstallment ? parseFloat(installmentMonthlyAmount) : 0

    if (isInstallment) {
      if (!monthly || monthly <= 0) {
        return NextResponse.json({ error: 'Monthly installment amount must be > 0' }, { status: 400 })
      }
      if (monthly >= totalAmount) {
        return NextResponse.json({ error: 'Monthly installment must be less than total amount' }, { status: 400 })
      }
    }

    const v = await db.trafficViolation.create({
      data: {
        driverId: driver.id,
        riderId: String(riderId),
        violationType,
        amount: totalAmount,
        ticketDate: ticketDate ? new Date(ticketDate) : new Date(),
        ticketNumber: ticketNumber || null,
        status: status || 'approved',
        notes: notes || null,
        installmentEnabled: isInstallment,
        installmentMonthlyAmount: monthly,
        installmentTotalPaid: 0,
        installmentStatus: isInstallment ? 'active' : 'none',
      },
    })

    await db.auditLog.create({
      data: {
        action: 'traffic_create',
        entityType: 'traffic_violation',
        entityId: v.id,
        description: `Added ${violationType} violation SAR ${totalAmount} for rider ${riderId}${isInstallment ? ` (installment: SAR ${monthly}/month)` : ''}`,
        metadata: JSON.stringify({ amount: totalAmount, type: violationType, installment: isInstallment, monthly }),
      },
    })

    return NextResponse.json({ violation: v })
  } catch (err: any) {
    console.error('POST /api/traffic-violations failed:', err)
    return NextResponse.json({ error: 'Create failed', message: err?.message }, { status: 500 })
  }
}

// PUT /api/traffic-violations — update violation
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const {
      id, violationType, amount, ticketDate, ticketNumber, status, notes,
      installmentEnabled, installmentMonthlyAmount,
    } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Fetch existing to preserve installmentTotalPaid when toggling
    const existing = await db.trafficViolation.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const totalAmount = amount !== undefined ? parseFloat(amount) : existing.amount
    const isInstallment = installmentEnabled !== undefined ? !!installmentEnabled : existing.installmentEnabled
    let monthly = installmentMonthlyAmount !== undefined ? parseFloat(installmentMonthlyAmount) : existing.installmentMonthlyAmount

    if (isInstallment) {
      if (!monthly || monthly <= 0) {
        return NextResponse.json({ error: 'Monthly installment amount must be > 0' }, { status: 400 })
      }
      if (monthly >= totalAmount) {
        return NextResponse.json({ error: 'Monthly installment must be less than total amount' }, { status: 400 })
      }
    }

    // If installment is being turned off, reset progress
    // If installment is being turned on fresh, start at 0
    // If already on and only monthly changed, preserve totalPaid
    let newTotalPaid = existing.installmentTotalPaid
    let newStatus = existing.installmentStatus
    if (!isInstallment) {
      newTotalPaid = 0
      newStatus = 'none'
    } else if (!existing.installmentEnabled) {
      newTotalPaid = 0
      newStatus = 'active'
    } else if (newTotalPaid >= totalAmount) {
      newStatus = 'completed'
    } else {
      newStatus = 'active'
    }

    const v = await db.trafficViolation.update({
      where: { id },
      data: {
        violationType,
        amount: totalAmount,
        ticketDate: ticketDate ? new Date(ticketDate) : undefined,
        ticketNumber,
        status,
        notes,
        installmentEnabled: isInstallment,
        installmentMonthlyAmount: isInstallment ? monthly : 0,
        installmentTotalPaid: newTotalPaid,
        installmentStatus: newStatus,
      },
    })

    return NextResponse.json({ violation: v })
  } catch (err: any) {
    console.error('PUT /api/traffic-violations failed:', err)
    return NextResponse.json({ error: 'Update failed', message: err?.message }, { status: 500 })
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
    await db.trafficViolation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/traffic-violations failed:', err)
    return NextResponse.json({ error: 'Delete failed', message: err?.message }, { status: 500 })
  }
}
