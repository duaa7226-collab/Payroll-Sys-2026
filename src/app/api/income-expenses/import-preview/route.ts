import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { calculateIncome } from '@/lib/income-expenses-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/income-expenses/import-preview
// Body: { month, companyName, rows: [{ riderId, driverName, basicPayment, ... }], forceUpdate }
// Returns: { imported, skipped, errors, totalIncome }
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { month, companyName, rows, forceUpdate, sourceFile } = body

    if (!month || !companyName || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'month, companyName, and rows[] are required' }, { status: 400 })
    }

    // First do a dry-run validation: detect duplicates, missing rider IDs, invalid amounts
    const errors: string[] = []
    const seenRiderIds = new Set<string>()
    const validRows: any[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const riderId = String(r.riderId ?? '').trim()
      if (!riderId) {
        errors.push(`Row ${i + 1}: missing rider_id`)
        continue
      }
      if (seenRiderIds.has(riderId)) {
        errors.push(`Row ${i + 1}: duplicate rider_id "${riderId}"`)
        continue
      }
      seenRiderIds.add(riderId)

      // Validate amounts are numbers
      const numFields = ['basicPayment','distancePayment','segmentPayment','acceptancePenalty','contactPenalty','stackingDeduction','declinedPenalty','latePenalty','noShowPenalty','noShowSpecialPenalty','dailyAcceptancePenalty','missedDaysPenalty','riderBalance']
      const cleanRow: any = { riderId, driverName: r.driverName || `Rider ${riderId}` }
      for (const k of numFields) {
        const v = r[k]
        if (v === undefined || v === null || v === '') cleanRow[k] = 0
        else if (isNaN(Number(v))) {
          errors.push(`Row ${i + 1} (rider ${riderId}): invalid ${k} = "${v}"`)
          cleanRow[k] = 0
        } else {
          cleanRow[k] = Number(v)
        }
      }
      if (r.customFieldsJson) cleanRow.customFieldsJson = r.customFieldsJson
      validRows.push(cleanRow)
    }

    // Check for existing records (without forceUpdate)
    const existingRecords = await db.incomeRecord.findMany({
      where: { month, companyName, riderId: { in: validRows.map(r => r.riderId) } },
      select: { riderId: true },
    })
    const existingRiderIds = new Set(existingRecords.map(r => r.riderId))
    const duplicatesInDb = validRows.filter(r => existingRiderIds.has(r.riderId))
    if (duplicatesInDb.length > 0 && !forceUpdate) {
      return NextResponse.json({
        error: 'Duplicate records in database',
        message: `${duplicatesInDb.length} record(s) already exist for ${companyName} in ${month}. Set forceUpdate=true to overwrite.`,
        duplicateRiderIds: duplicatesInDb.map(r => r.riderId),
      }, { status: 409 })
    }

    // If this is just a preview (preview=true), return calculated totals without saving
    if (body.preview === true) {
      const previewRows = validRows.map(r => {
        const calc = calculateIncome(r)
        return { ...r, calculatedIncome: calc }
      })
      return NextResponse.json({
        preview: true,
        rowCount: previewRows.length,
        errors,
        rows: previewRows,
        totalIncome: previewRows.reduce((s, r) => s + r.calculatedIncome.totalIncome, 0),
      })
    }

    // Actually save
    let imported = 0
    let updated = 0
    for (const r of validRows) {
      // Find Driver by riderId
      const driver = await db.driver.findUnique({ where: { riderId: r.riderId } })
      const driverId = driver?.id || null

      const data = {
        driverId,
        driverName: r.driverName,
        companyName,
        basicPayment: r.basicPayment || 0,
        distancePayment: r.distancePayment || 0,
        segmentPayment: r.segmentPayment || 0,
        acceptancePenalty: r.acceptancePenalty || 0,
        contactPenalty: r.contactPenalty || 0,
        stackingDeduction: r.stackingDeduction || 0,
        declinedPenalty: r.declinedPenalty || 0,
        latePenalty: r.latePenalty || 0,
        noShowPenalty: r.noShowPenalty || 0,
        noShowSpecialPenalty: r.noShowSpecialPenalty || 0,
        dailyAcceptancePenalty: r.dailyAcceptancePenalty || 0,
        missedDaysPenalty: r.missedDaysPenalty || 0,
        riderBalance: r.riderBalance || 0,
        customFieldsJson: r.customFieldsJson || null,
        sourceFile: sourceFile || null,
        importedBy: 'admin',
      }
      const calc = calculateIncome(data)
      const fullData = { ...data, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties }

      const existing = await db.incomeRecord.findUnique({
        where: { month_riderId_companyName: { month, riderId: r.riderId, companyName } },
      })
      if (existing) {
        await db.incomeRecord.update({ where: { id: existing.id }, data: fullData })
        updated++
      } else {
        await db.incomeRecord.create({ data: { month, riderId: r.riderId, ...fullData } })
        imported++
      }
    }

    await db.auditLog.create({
      data: {
        action: 'income_import',
        entityType: 'income_record',
        description: `Imported ${imported + updated} income records for ${companyName} ${month}`,
        metadata: JSON.stringify({ month, companyName, imported, updated, sourceFile }),
      },
    })

    return NextResponse.json({
      success: true,
      imported,
      updated,
      errors,
      totalProcessed: validRows.length,
    })
  } catch (err: any) {
    console.error('POST /api/income-expenses/import-preview failed:', err)
    return NextResponse.json({ error: 'Import failed', message: err?.message }, { status: 500 })
  }
}
