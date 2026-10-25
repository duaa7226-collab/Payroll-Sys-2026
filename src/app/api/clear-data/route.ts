import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { PAYROLL_JOB, withJobLock } from '@/lib/job-lock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/clear-data
// Clears ALL payroll runs, driver results, income records, expenses, driver counts, exceptions
// Keeps: drivers, rules, company profile, traffic violations, custom bonuses/deductions
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth

  return withJobLock(PAYROLL_JOB, 'Clear all payroll data', async () => {
    try {
      const body = await req.json().catch(() => ({}))
      const { confirm } = body

      if (!confirm) {
        return NextResponse.json({
          error: 'Confirmation required',
          message: 'Set confirm=true to proceed. This will delete ALL payroll runs, driver results, income records, expenses, and driver counts. This action cannot be undone.',
        }, { status: 400 })
      }

      // All-or-nothing, so a failure can never leave orphaned results behind.
      const deleted = await db.$transaction(async tx => {
        const driverResults = await tx.driverResult.deleteMany({})
        const payrollExceptions = await tx.payrollException.deleteMany({})
        const payrollRuns = await tx.payrollRun.deleteMany({})
        const incomeRecords = await tx.incomeRecord.deleteMany({})
        const expenses = await tx.expense.deleteMany({})
        const driverCounts = await tx.driverCount.deleteMany({})

        return {
          driverResults: driverResults.count,
          payrollRuns: payrollRuns.count,
          incomeRecords: incomeRecords.count,
          expenses: expenses.count,
          driverCounts: driverCounts.count,
          payrollExceptions: payrollExceptions.count,
        }
      }, { maxWait: 15_000, timeout: 90_000 })

      await db.auditLog.create({
        data: {
          action: 'clear_all_data',
          entityType: 'system',
          performedBy: auth.email || 'admin',
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
  }) as Promise<NextResponse>
}
