import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/clear-data
// Clears ALL payroll runs, driver results, income records, expenses, driver counts, exceptions
// Keeps: drivers, rules, company profile, traffic violations, custom bonuses/deductions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { confirm } = body

    if (!confirm) {
      return NextResponse.json({
        error: 'Confirmation required',
        message: 'Set confirm=true to proceed. This will delete ALL payroll runs, driver results, income records, expenses, and driver counts. This action cannot be undone.',
      }, { status: 400 })
    }

    let deleted = {
      driverResults: 0,
      payrollRuns: 0,
      incomeRecords: 0,
      expenses: 0,
      driverCounts: 0,
      payrollExceptions: 0,
    }

    // Delete in dependency order (child tables first)
    deleted.driverResults = await db.driverResult.deleteMany({})
    deleted.payrollExceptions = await db.payrollException.deleteMany({})
    deleted.payrollRuns = await db.payrollRun.deleteMany({})
    deleted.incomeRecords = await db.incomeRecord.deleteMany({})
    deleted.expenses = await db.expense.deleteMany({})
    deleted.driverCounts = await db.driverCount.deleteMany({})

    await db.auditLog.create({
      data: {
        action: 'clear_all_data',
        entityType: 'system',
        description: `Cleared all payroll data: ${deleted.driverResults} results, ${deleted.payrollRuns} runs, ${deleted.incomeRecords} income records, ${deleted.expenses} expenses, ${deleted.driverCounts} driver counts`,
        metadata: JSON.stringify({ deleted }),
      },
    })

    return NextResponse.json({
      success: true,
      deleted,
      message: 'All payroll data cleared successfully. Upload a new Excel file to start fresh.',
    })
  } catch (err: any) {
    console.error('POST /api/clear-data failed:', err)
    return NextResponse.json({ error: 'Clear failed', message: err?.message }, { status: 500 })
  }
}
