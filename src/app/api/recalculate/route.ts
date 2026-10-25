import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { getAllRiderTrafficDeductions } from '@/lib/traffic-helpers'
import { getAllRiderManualAdjustments } from '@/lib/manual-adjustment-helpers'
import { getActiveCustomBonuses, getBonusesForRider } from '@/lib/custom-bonus-helpers'
import { getActiveCustomDeductions, getDeductionsForRider } from '@/lib/custom-deduction-helpers'
import { calculateDriverSalary, type DriverResultCalc } from '@/lib/salary-engine'
import {
  buildRawFromResult,
  chunk,
  driverExceptionRows,
  driverResultCreateData,
  sumTotals,
} from '@/lib/payroll-persist'
import { PAYROLL_JOB, withJobLock } from '@/lib/job-lock'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/recalculate?runId=...
// Recalculates ALL driver results using current data (rules, custom bonuses /
// deductions, manual adjustments, traffic violations).
//
// IMPORTANT: recalculating does NOT advance installment progress. Installments
// are only advanced once per new payroll month at import time — recalculating
// used to charge every active installment again on each run.
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth

  return withJobLock(PAYROLL_JOB, 'Payroll recalculation', async () => {
    try {
      const { searchParams } = new URL(req.url)
      const runId = searchParams.get('runId')
      if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })

      const payrollRun = await db.payrollRun.findUnique({ where: { id: runId } })
      if (!payrollRun) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })

      const [activeRules, existingResults, customBonuses, customDeductions] = await Promise.all([
        getActiveRuleSnapshot(),
        db.driverResult.findMany({ where: { payrollRunId: runId } }),
        getActiveCustomBonuses(),
        getActiveCustomDeductions(),
      ])

      if (existingResults.length === 0) {
        return NextResponse.json(
          { error: 'Nothing to recalculate', message: 'This payroll run has no driver results.' },
          { status: 400 }
        )
      }

      const riderIds = existingResults.map(r => r.riderId)
      const driverIds = Array.from(new Set(existingResults.map(r => r.driverId)))

      const [trafficByRider, manualByRider, drivers] = await Promise.all([
        getAllRiderTrafficDeductions(riderIds),
        getAllRiderManualAdjustments(riderIds),
        db.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true } }),
      ])
      const validDriverIds = new Set(drivers.map(d => d.id))

      const sources = {
        trafficByRider,
        manualByRider,
        customBonuses,
        customDeductions,
        riderBonuses: (riderId: string) =>
          getBonusesForRider(customBonuses, riderId).map(b => ({ name: b.name, nameAr: b.nameAr, amount: b.amount })),
        riderDeductions: (riderId: string) =>
          getDeductionsForRider(customDeductions, riderId).map(d => ({
            name: d.name, nameAr: d.nameAr, amount: d.amount, monthlyDeduction: d.monthlyDeduction,
          })),
      }

      const results: DriverResultCalc[] = []
      const rows: ReturnType<typeof driverResultCreateData>[] = []
      for (const existing of existingResults) {
        if (!validDriverIds.has(existing.driverId)) continue
        const raw = buildRawFromResult(existing, sources)
        const result = calculateDriverSalary(raw, activeRules.snapshot, activeRules.ruleSetName, payrollRun.payrollMonth)
        results.push(result)
        rows.push(driverResultCreateData(runId, existing.driverId, result))
      }

      if (results.length === 0) {
        return NextResponse.json(
          { error: 'Nothing to recalculate', message: 'No driver master records matched this run.' },
          { status: 400 }
        )
      }

      const totals = sumTotals(results)

      // Single transaction: all-or-nothing so a failure can never leave the run
      // half-emptied (the old code deleted first, then inserted row by row).
      await db.$transaction(async tx => {
        await tx.driverResult.deleteMany({ where: { payrollRunId: runId } })
        // Keep parser warnings from the import; regenerate only calculation flags.
        await tx.payrollException.deleteMany({
          where: { payrollRunId: runId, code: { in: ['MAJOR_VARIANCE', 'REVIEW_FLAGGED'] } },
        })

        for (const batch of chunk(rows, 200)) {
          await tx.driverResult.createMany({ data: batch })
        }

        const exceptions = results.flatMap(result => driverExceptionRows(runId, result))
        for (const batch of chunk(exceptions, 500)) {
          await tx.payrollException.createMany({ data: batch })
        }

        await tx.payrollRun.update({
          where: { id: runId },
          data: {
            ...totals,
            totalDrivers: results.length,
            ruleSetId: activeRules.ruleSetId,
            ruleSnapshot: JSON.stringify(activeRules.snapshot),
            status: 'completed',
          },
        })

        await tx.auditLog.create({
          data: {
            action: 'recalculate',
            entityType: 'payroll_run',
            entityId: runId,
            ruleSetId: activeRules.ruleSetId,
            performedBy: auth.email || 'admin',
            description: `Recalculated ${results.length} driver results for ${payrollRun.payrollMonth}`,
            metadata: JSON.stringify({
              ruleSetName: activeRules.ruleSetName,
              totals,
            }),
          },
        })
      }, { maxWait: 15_000, timeout: 90_000 })

      return NextResponse.json({
        success: true,
        driverCount: results.length,
        totals,
        rules: {
          ruleSetName: activeRules.ruleSetName,
          ruleCount: activeRules.ruleCount,
        },
      })
    } catch (e: any) {
      console.error('Recalculate failed:', e)
      return NextResponse.json(
        { error: 'Recalculation failed', message: e?.message || 'Unexpected error during recalculation.' },
        { status: 500 }
      )
    }
  }) as Promise<NextResponse>
}
