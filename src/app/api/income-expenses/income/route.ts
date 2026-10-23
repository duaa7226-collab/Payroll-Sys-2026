import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { calculateIncome } from '@/lib/income-expenses-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/income?month=2026-08
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const where: any = {}
    if (month) where.month = month
    const records = await db.incomeRecord.findMany({ where, orderBy: [{ month: 'desc' }, { riderId: 'asc' }] })
    // Calculate totalIncome for each record
    const enriched = records.map(r => ({ ...r, calculatedIncome: calculateIncome(r) }))
    return NextResponse.json({ records: enriched })
  } catch (err: any) {
    console.error('GET /api/income-expenses/income failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// POST — create or update a single income record (manual entry / correction)
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const {
      month, riderId, driverName, companyName,
      basicPayment, distancePayment, segmentPayment,
      acceptancePenalty, contactPenalty, stackingDeduction,
      declinedPenalty, latePenalty, noShowPenalty,
      noShowSpecialPenalty, dailyAcceptancePenalty, missedDaysPenalty,
      riderBalance, customFieldsJson, sourceFile, importNotes, forceUpdate,
    } = body

    if (!month || !riderId || !driverName || !companyName) {
      return NextResponse.json({ error: 'month, riderId, driverName, companyName are required' }, { status: 400 })
    }

    // Check for existing record (month + riderId + companyName)
    const existing = await db.incomeRecord.findUnique({
      where: { month_riderId_companyName: { month, riderId: String(riderId), companyName } },
    })

    if (existing && !forceUpdate) {
      return NextResponse.json({
        error: 'Duplicate record',
        message: `A record for rider ${riderId} (${companyName}) in ${month} already exists. Set forceUpdate=true to overwrite.`,
        existing,
      }, { status: 409 })
    }

    // Try to find Driver by riderId to link the record
    const driver = await db.driver.findUnique({ where: { riderId: String(riderId) } })
    const driverId = driver?.id || null

    const data = {
      driverId,
      driverName,
      companyName,
      basicPayment: Number(basicPayment) || 0,
      distancePayment: Number(distancePayment) || 0,
      segmentPayment: Number(segmentPayment) || 0,
      acceptancePenalty: Number(acceptancePenalty) || 0,
      contactPenalty: Number(contactPenalty) || 0,
      stackingDeduction: Number(stackingDeduction) || 0,
      declinedPenalty: Number(declinedPenalty) || 0,
      latePenalty: Number(latePenalty) || 0,
      noShowPenalty: Number(noShowPenalty) || 0,
      noShowSpecialPenalty: Number(noShowSpecialPenalty) || 0,
      dailyAcceptancePenalty: Number(dailyAcceptancePenalty) || 0,
      missedDaysPenalty: Number(missedDaysPenalty) || 0,
      riderBalance: Number(riderBalance) || 0,
      customFieldsJson: customFieldsJson || null,
      sourceFile: sourceFile || null,
      importNotes: importNotes || null,
      importedBy: 'admin',
    }

    // Calculate totals
    const calc = calculateIncome(data)
    const fullData = { ...data, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties }

    let record
    if (existing) {
      record = await db.incomeRecord.update({ where: { id: existing.id }, data: fullData })
      await db.auditLog.create({
        data: {
          action: 'income_update',
          entityType: 'income_record',
          entityId: record.id,
          description: `Updated income for rider ${riderId} (${companyName}) ${month}`,
          metadata: JSON.stringify({ month, riderId, companyName }),
        },
      })
    } else {
      record = await db.incomeRecord.create({ data: { month, riderId: String(riderId), ...fullData } })
      await db.auditLog.create({
        data: {
          action: 'income_create',
          entityType: 'income_record',
          entityId: record.id,
          description: `Created income for rider ${riderId} (${companyName}) ${month}`,
          metadata: JSON.stringify({ month, riderId, companyName }),
        },
      })
    }

    return NextResponse.json({ record })
  } catch (err: any) {
    console.error('POST /api/income-expenses/income failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// PUT — update by id
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // Convert numeric fields
    const numFields = ['basicPayment','distancePayment','segmentPayment','acceptancePenalty','contactPenalty','stackingDeduction','declinedPenalty','latePenalty','noShowPenalty','noShowSpecialPenalty','dailyAcceptancePenalty','missedDaysPenalty','riderBalance']
    const data: any = {}
    for (const k of Object.keys(updates)) {
      if (numFields.includes(k)) data[k] = Number(updates[k]) || 0
      else data[k] = updates[k]
    }

    // Recalculate totals
    const calc = calculateIncome(data)
    data.totalIncome = calc.totalIncome
    data.totalPenalties = calc.totalPenalties

    const record = await db.incomeRecord.update({ where: { id }, data })
    await db.auditLog.create({
      data: {
        action: 'income_update',
        entityType: 'income_record',
        entityId: id,
        description: `Updated income record ${id}`,
        metadata: JSON.stringify({ id, updates }),
      },
    })
    return NextResponse.json({ record })
  } catch (err: any) {
    console.error('PUT /api/income-expenses/income failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}

// DELETE — by id
export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await db.incomeRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/income-expenses/income failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
