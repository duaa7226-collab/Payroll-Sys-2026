import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { parseWorkbook } from '@/lib/excel-parser'
import { calculateDriverSalary } from '@/lib/salary-engine'

// POST /api/import — accepts multipart/form-data with file + payrollMonth
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const payrollMonth = (formData.get('payrollMonth') as string) || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let parsed
    try {
      parsed = parseWorkbook(buffer)
    } catch (e: any) {
      return NextResponse.json({
        error: 'Workbook parsing failed',
        message: e.message,
        warnings: [],
      }, { status: 422 })
    }

    const activeRules = await getActiveRuleSnapshot()

    // Get traffic violations per driver
    const allViolations = await db.trafficViolation.findMany({
      where: { status: 'approved' },
    })
    const violationsByRider = new Map<string, number>()
    for (const v of allViolations) {
      violationsByRider.set(v.riderId, (violationsByRider.get(v.riderId) ?? 0) + v.amount)
    }

    // Enrich raw drivers with traffic violations
    for (const d of parsed.drivers) {
      d.trafficViolationsTotal = violationsByRider.get(d.riderId) ?? 0
    }

    // Create payroll run
    const payrollRun = await db.payrollRun.create({
      data: {
        payrollMonth,
        fileName: file.name,
        ruleSetId: activeRules.ruleSetId,
        ruleSnapshot: JSON.stringify(activeRules.snapshot),
        status: 'processing',
        importedBy: 'admin',
      },
    })

    // Upsert drivers and calculate results
    let totalGross = 0, totalPenalties = 0, totalNet = 0, totalVariance = 0, totalTraffic = 0
    for (const raw of parsed.drivers) {
      const driver = await db.driver.upsert({
        where: { riderId: raw.riderId },
        create: {
          riderId: raw.riderId,
          name: raw.name,
          contractName: raw.contractName,
          vehicleType: raw.vehicleType,
        },
        update: {
          name: raw.name,
          contractName: raw.contractName,
          vehicleType: raw.vehicleType,
        },
      })

      const result = calculateDriverSalary(raw, activeRules.snapshot, activeRules.ruleSetName, payrollMonth)

      await db.driverResult.create({
        data: {
          payrollRunId: payrollRun.id,
          driverId: driver.id,
          riderId: result.riderId,
          driverName: result.driverName,
          contractName: result.contractName,
          payrollMonth: result.payrollMonth,
          vehicleType: result.vehicleType,
          inactiveReason: result.inactiveReason,
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

    // Save exceptions for warnings
    for (const w of parsed.warnings) {
      await db.payrollException.create({
        data: {
          payrollRunId: payrollRun.id,
          code: 'IMPORT_WARNING',
          severity: 'warning',
          source: 'parser',
          message: w,
          suggestedAction: 'Review source workbook structure',
        },
      })
    }

    await db.payrollRun.update({
      where: { id: payrollRun.id },
      data: {
        status: 'completed',
        totalDrivers: parsed.drivers.length,
        totalGross,
        totalPenalties,
        totalNet,
        totalVariance,
        totalTraffic,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'import',
        entityType: 'payroll_run',
        entityId: payrollRun.id,
        ruleSetId: activeRules.ruleSetId,
        description: `Imported ${file.name} for ${payrollMonth} — ${parsed.drivers.length} drivers`,
        metadata: JSON.stringify({ fileName: file.name, driverCount: parsed.drivers.length, warnings: parsed.warnings.length }),
      },
    })

    return NextResponse.json({
      success: true,
      payrollRunId: payrollRun.id,
      driverCount: parsed.drivers.length,
      warnings: parsed.warnings,
      totals: { totalGross, totalPenalties, totalNet, totalVariance, totalTraffic },
    })
  } catch (e: any) {
    console.error('Import failed:', e)
    return NextResponse.json({ error: 'Import failed', message: e.message }, { status: 500 })
  }
}
