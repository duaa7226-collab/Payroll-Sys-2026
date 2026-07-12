import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { getAllRiderTrafficDeductions } from '@/lib/traffic-helpers'
import { getAllRiderManualAdjustments } from '@/lib/manual-adjustment-helpers'
import { getActiveCustomBonuses } from '@/lib/custom-bonus-helpers'
import { getActiveCustomDeductions } from '@/lib/custom-deduction-helpers'
import { calculateDriverSalary } from '@/lib/salary-engine'

// POST /api/recalculate?runId=...
// Recalculates ALL driver results using current data (custom bonuses, traffic, manual adjustments, rules)
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')
    if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })

    const payrollRun = await db.payrollRun.findUnique({ where: { id: runId } })
    if (!payrollRun) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })

    const activeRules = await getActiveRuleSnapshot()
    const existingResults = await db.driverResult.findMany({ where: { payrollRunId: runId } })
    const riderIds = existingResults.map(r => r.riderId)

    const trafficByRider = await getAllRiderTrafficDeductions(riderIds)
    const manualByRider = await getAllRiderManualAdjustments(riderIds)
    const customBonuses = await getActiveCustomBonuses()
    const customDeductions = await getActiveCustomDeductions()

    let totalGross = 0, totalPenalties = 0, totalNet = 0, totalVariance = 0, totalTraffic = 0

    await db.driverResult.deleteMany({ where: { payrollRunId: runId } })
    await db.payrollException.deleteMany({ where: { payrollRunId: runId } })

    for (const existing of existingResults) {
      const driver = await db.driver.findUnique({ where: { id: existing.driverId } })
      if (!driver) continue

      const raw = {
        riderId: existing.riderId,
        name: existing.driverName,
        contractName: existing.contractName,
        vehicleType: existing.vehicleType,
        inactiveReason: existing.inactiveReason || 'Active',
        completedOrders: existing.completedOrders,
        uploadedBasicPayment: existing.uploadedBasicPayment,
        uploadedCityPayment: existing.uploadedCityPayment,
        actualWorkingDays: existing.actualWorkingDays,
        fullyWorkingDays: existing.fullyWorkingDays,
        workingHours: existing.workingHours,
        totalMonthlyWorkingHours: existing.totalMonthlyWorkingHours,
        penalties: JSON.parse(existing.penaltiesJson || '{}'),
        carDeduction: 0,
        tgaDeduction: 0,
        riderBalance: JSON.parse(existing.penaltiesJson || '{}').rider_balance || 0,
        segmentPayment: existing.segmentPayment || 0,
        trafficViolationsTotal: trafficByRider.get(existing.riderId)?.total ?? 0,
        manualBonuses: (manualByRider.get(existing.riderId)?.bonuses ?? []).map(b => ({ title: b.title, amount: b.amount })),
        manualDeductions: (manualByRider.get(existing.riderId)?.deductions ?? []).map(d => ({ title: d.title, amount: d.amount })),
        customBonuses: customBonuses.map(b => ({ name: b.name, nameAr: b.nameAr, amount: b.amount })),
        customDeductions: customDeductions.map(d => ({ name: d.name, nameAr: d.nameAr, amount: d.amount })),
      }

      const result = calculateDriverSalary(raw, activeRules.snapshot, activeRules.ruleSetName, payrollRun.payrollMonth)

      await db.driverResult.create({
        data: {
          payrollRunId: runId, driverId: driver.id,
          riderId: result.riderId, driverName: result.driverName,
          contractName: result.contractName, payrollMonth: result.payrollMonth,
          vehicleType: result.vehicleType, inactiveReason: result.inactiveReason,
          completedOrders: result.completedOrders,
          uploadedBasicPayment: result.uploadedBasicPayment,
          uploadedCityPayment: result.uploadedCityPayment,
          actualWorkingDays: result.actualWorkingDays,
          fullyWorkingDays: result.fullyWorkingDays,
          workingHours: result.workingHours,
          totalMonthlyWorkingHours: result.totalMonthlyWorkingHours,
          activeRuleSetName: result.activeRuleSetName,
          salaryDivisorMode: result.salaryDivisorMode,
          appliedBaseSalary: result.appliedBaseSalary,
          appliedStdWorkingDays: result.appliedStdWorkingDays,
          appliedMonthlyTarget: result.appliedMonthlyTarget,
          appliedDailyTargetRate: result.appliedDailyTargetRate,
          appliedSalaryPerOrder: result.appliedSalaryPerOrder,
          appliedBonusPerExtra: result.appliedBonusPerExtra,
          appliedDeductionPerMissing: result.appliedDeductionPerMissing,
          trafficDeductionsEnabled: result.trafficDeductionsEnabled,
          dailyBaseRate: result.dailyBaseRate,
          adjustedBaseSalary: result.adjustedBaseSalary,
          adjustedTargetOrders: result.adjustedTargetOrders,
          selectedTargetThreshold: result.selectedTargetThreshold,
          baseSalaryEquivalent: result.baseSalaryEquivalent,
          extraOrders: result.extraOrders,
          missingOrders: result.missingOrders,
          bonusAmount: result.bonusAmount,
          missingOrderDeduction: result.missingOrderDeduction,
          segmentPayment: result.segmentPayment,
          penaltiesJson: JSON.stringify(result.penalties),
          totalOtherPenalties: result.totalOtherPenalties,
          trafficViolationsDeduction: result.trafficViolationsDeduction,
          grossSalaryBeforePenalties: result.grossSalaryBeforePenalties,
          finalNetSalary: result.finalNetSalary,
          varianceAmount: result.varianceAmount,
          variancePercentage: result.variancePercentage,
          varianceStatus: result.varianceStatus,
          reviewStatus: result.reviewStatus,
          exceptionFlag: result.exceptionFlag,
          performanceBand: result.performanceBand,
        },
      })

      totalGross += result.grossSalaryBeforePenalties
      totalPenalties += result.totalOtherPenalties
      totalNet += result.finalNetSalary
      totalVariance += Math.abs(result.varianceAmount)
      totalTraffic += result.trafficViolationsDeduction
    }

    await db.payrollRun.update({
      where: { id: runId },
      data: { totalGross, totalPenalties, totalNet, totalVariance, totalTraffic, ruleSnapshot: JSON.stringify(activeRules.snapshot) },
    })

    return NextResponse.json({
      success: true,
      driverCount: existingResults.length,
      totals: { totalGross, totalPenalties, totalNet, totalVariance, totalTraffic },
    })
  } catch (e: any) {
    console.error('Recalculate failed:', e)
    return NextResponse.json({ error: 'Recalculation failed', message: e.message }, { status: 500 })
  }
}
