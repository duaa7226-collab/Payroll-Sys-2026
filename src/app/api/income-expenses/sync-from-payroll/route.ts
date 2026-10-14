import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateIncome } from '@/lib/income-expenses-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper: convert "2026-08" → "August 2026" (PayrollRun.payrollMonth format)
function monthToLabel(month: string): string {
  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return month || 'undefined'
  }
  try {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, 1)
    if (isNaN(date.getTime())) return month
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return month
  }
}

// Helper: try to find a payroll run matching the given month
async function findPayrollRunForMonth(month: string): Promise<any | null> {
  // Try exact match on payrollMonth label (e.g., "August 2026")
  const label = monthToLabel(month)
  let run = await db.payrollRun.findFirst({
    where: { payrollMonth: { equals: label } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { results: true } } },
  })
  if (run) return run

  // Fallback: try case-insensitive match
  run = await db.payrollRun.findFirst({
    where: { payrollMonth: { contains: label.split(' ')[0] } },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { results: true } } },
  })
  return run
}

// POST /api/income-expenses/sync-from-payroll
// Body: { month: "2026-08", companyName?: "HungerStation", forceUpdate?: boolean }
// Syncs income data from the payroll run's DriverResult records into IncomeRecord records.
// Also sets the driver count from the number of drivers in the payroll run.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { month, companyName, forceUpdate } = body

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({
        error: 'Invalid month',
        message: 'Month must be in YYYY-MM format (e.g. "2026-08").',
      }, { status: 400 })
    }

    // Find the matching payroll run
    const run = await findPayrollRunForMonth(month)
    if (!run) {
      return NextResponse.json({
        error: 'No payroll run found for this month',
        message: `No payroll run found for ${monthToLabel(month)}. Please import the monthly Excel file first (Monthly Import tab), then sync here.`,
      }, { status: 404 })
    }

    // Get all DriverResult records for this payroll run
    const results = await db.driverResult.findMany({
      where: { payrollRunId: run.id },
      orderBy: { riderId: 'asc' },
    })

    if (results.length === 0) {
      return NextResponse.json({
        error: 'Payroll run has no driver results',
        message: `The payroll run for ${run.payrollMonth} exists but has no driver results.`,
      }, { status: 404 })
    }

    const company = companyName || 'HungerStation'
    let imported = 0
    let updated = 0
    const errors: string[] = []

    // Check for existing records
    const existingRecords = await db.incomeRecord.findMany({
      where: { month, companyName: company, riderId: { in: results.map(r => r.riderId) } },
      select: { id: true, riderId: true },
    })
    const existingByRider = new Map(existingRecords.map(r => [r.riderId, r]))

    if (existingRecords.length > 0 && !forceUpdate) {
      return NextResponse.json({
        error: 'Records already exist',
        message: `${existingRecords.length} income record(s) already exist for ${company} in ${month}. Set forceUpdate=true to overwrite with data from the payroll run.`,
        existingCount: existingRecords.length,
        payrollRunId: run.id,
        payrollMonth: run.payrollMonth,
      }, { status: 409 })
    }

    // Sync each driver result
    for (const dr of results) {
      const riderId = dr.riderId
      const driverName = dr.driverName
      const penalties = JSON.parse(dr.penaltiesJson || '{}')

      // Map DriverResult fields → IncomeRecord fields
      // uploadedBasicPayment = the basic_payment from RLVL (Excel's actual earned amount)
      // penaltiesJson stores SHORT keys (stacking, missed_days, rider_balance, distance, segment, etc.)
      const incomeData = {
        driverId: (await db.driver.findUnique({ where: { riderId } }))?.id || null,
        driverName,
        companyName: company,
        basicPayment: dr.uploadedBasicPayment || 0,
        distancePayment: penalties.distance || 0,
        segmentPayment: penalties.segment || dr.segmentPayment || 0,
        acceptancePenalty: penalties.acceptance || 0,
        contactPenalty: penalties.contact || 0,
        stackingDeduction: penalties.stacking || 0,
        declinedPenalty: penalties.declined || 0,
        latePenalty: penalties.late || 0,
        noShowPenalty: penalties.noshow || 0,
        noShowSpecialPenalty: penalties.noshow_special || 0,
        dailyAcceptancePenalty: penalties.daily_acceptance || 0,
        missedDaysPenalty: penalties.missed_days || 0,
        riderBalance: penalties.rider_balance || 0,
        customFieldsJson: null,
        sourceFile: run.fileName,
        importedBy: 'admin',
      }

      const calc = calculateIncome(incomeData)
      const fullData = { ...incomeData, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties }

      const existing = existingByRider.get(riderId)
      if (existing) {
        await db.incomeRecord.update({ where: { id: existing.id }, data: fullData })
        updated++
      } else {
        await db.incomeRecord.create({ data: { month, riderId, ...fullData } })
        imported++
      }
    }

    // Set the driver count from the payroll run (if not already set manually or if forceUpdate)
    const existingCount = await db.driverCount.findUnique({ where: { month } })
    if (!existingCount || forceUpdate) {
      await db.driverCount.upsert({
        where: { month },
        create: {
          month,
          activeDriverCount: results.length,
          notes: `Auto-synced from payroll run: ${run.payrollMonth} (${run.fileName})`,
          confirmedBy: 'system-sync',
        },
        update: {
          activeDriverCount: results.length,
          notes: `Auto-synced from payroll run: ${run.payrollMonth} (${run.fileName})`,
          confirmedBy: 'system-sync',
        },
      })
    }

    await db.auditLog.create({
      data: {
        action: 'income_sync_payroll',
        entityType: 'income_record',
        description: `Synced ${imported + updated} income records from payroll run ${run.payrollMonth} for ${company} ${month}`,
        metadata: JSON.stringify({ month, company, imported, updated, payrollRunId: run.id }),
      },
    })

    return NextResponse.json({
      success: true,
      imported,
      updated,
      driverCount: results.length,
      payrollRun: {
        id: run.id,
        payrollMonth: run.payrollMonth,
        fileName: run.fileName,
      },
      message: `Synced ${imported + updated} drivers from ${run.payrollMonth}. Driver count set to ${results.length}.`,
    })
  } catch (err: any) {
    console.error('POST /api/income-expenses/sync-from-payroll failed:', err)
    return NextResponse.json({ error: 'Sync failed', message: err?.message }, { status: 500 })
  }
}

// GET — check if a payroll run exists for the month (for the UI to show sync button)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({
        found: false,
        error: 'Invalid month format. Must be YYYY-MM (e.g. 2026-08).',
        month: month || '',
        label: month || 'undefined',
      }, { status: 200 })
    }

    const run = await findPayrollRunForMonth(month)
    if (!run) {
      return NextResponse.json({ found: false, month, label: monthToLabel(month) })
    }

    const results = await db.driverResult.findMany({
      where: { payrollRunId: run.id },
      select: { riderId: true, driverName: true, uploadedBasicPayment: true, penaltiesJson: true },
    })

    // Check existing income records
    const existingIncome = await db.incomeRecord.findMany({
      where: { month },
      select: { riderId: true, companyName: true },
    })

    return NextResponse.json({
      found: true,
      month,
      label: monthToLabel(month),
      payrollRun: {
        id: run.id,
        payrollMonth: run.payrollMonth,
        fileName: run.fileName,
        driverCount: results.length,
      },
      existingIncomeCount: existingIncome.length,
      existingCompanies: Array.from(new Set(existingIncome.map(r => r.companyName))),
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
