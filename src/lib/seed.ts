// Seed script — loads default rule set + May 2026 workbook into the database
import { db } from './db'
import { createDefaultActiveRuleSet, getActiveRuleSnapshot } from './rule-helpers'
import { parseWorkbook } from './excel-parser'
import { calculateDriverSalary } from './salary-engine'
import { getActiveCustomBonuses } from './custom-bonus-helpers'
import { getActiveCustomDeductions } from './custom-deduction-helpers'
import { readFileSync } from 'fs'
import { resolve } from 'path'

async function main() {
  console.log('=== Seeding payroll database ===')

  // 1. Create company profile if missing
  const existingCompany = await db.companyProfile.findFirst()
  if (!existingCompany) {
    await db.companyProfile.create({
      data: {
        name: 'Nokhaba Tatweer for Trading',
        nameAr: 'مؤسسة نخبة التطوير للتجارة',
        address: 'Riyadh, Saudi Arabia',
        addressAr: 'الرياض، المملكة العربية السعودية',
        phone: '+966 11 000 0000',
        email: 'finance@nokhaba-tatweer.com',
        vatNumber: '310133979100003',
        crNumber: 'N/A',
        accManagerName: 'Accounting Manager',
        footerNote: 'This is a computer-generated payslip and does not require a physical signature.',
        footerNoteAr: 'هذه قسيمة راتب مُولّدة آليًا ولا تتطلب توقيعًا يدويًا.',
      },
    })
    console.log('Created company profile')
  } else {
    // Ensure accManagerName field exists (added in latest schema)
    if (!existingCompany.accManagerName) {
      await db.companyProfile.update({
        where: { id: existingCompany.id },
        data: { accManagerName: 'Accounting Manager' },
      })
    }
  }

  // 2. Ensure default active rule set
  const activeRules = await getActiveRuleSnapshot()
  console.log(`Active rule set: ${activeRules.ruleSetName} (${activeRules.ruleSetId})`)

  // 3. Parse the May 2026 workbook
  const workbookPath = resolve(process.cwd(), 'upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
  const buffer = readFileSync(workbookPath)
  const parsed = parseWorkbook(buffer)
  console.log(`Parsed workbook: ${parsed.drivers.length} drivers, ${parsed.warnings.length} warnings`)
  for (const w of parsed.warnings) console.log(`  WARN: ${w}`)

  // 4. Create or update drivers
  for (const d of parsed.drivers) {
    await db.driver.upsert({
      where: { riderId: d.riderId },
      create: {
        riderId: d.riderId,
        name: d.name,
        contractName: d.contractName,
        vehicleType: d.vehicleType,
      },
      update: {
        name: d.name,
        contractName: d.contractName,
        vehicleType: d.vehicleType,
      },
    })
  }

  // 5. Create payroll run — delete ALL existing runs first (re-seed with corrected calc)
  const payrollMonth = 'May 2026'
  const existingRuns = await db.payrollRun.findMany()
  for (const r of existingRuns) {
    await db.driverResult.deleteMany({ where: { payrollRunId: r.id } })
    await db.payrollException.deleteMany({ where: { payrollRunId: r.id } })
    await db.payrollRun.delete({ where: { id: r.id } })
  }
  console.log(`Cleared ${existingRuns.length} existing payroll runs for re-seed`)

  const payrollRun = await db.payrollRun.create({
    data: {
      payrollMonth,
      fileName: 'nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx',
      ruleSetId: activeRules.ruleSetId,
      ruleSnapshot: JSON.stringify(activeRules.snapshot),
      status: 'completed',
      importedBy: 'system',
    },
  })

  // 6. Calculate results (with custom bonuses and deductions from Rules Control Center)
  const customBonuses = await getActiveCustomBonuses()
  const customDeductions = await getActiveCustomDeductions()
  let totalGross = 0, totalPenalties = 0, totalNet = 0, totalVariance = 0, totalTraffic = 0
  for (const raw of parsed.drivers) {
    const driver = await db.driver.findUnique({ where: { riderId: raw.riderId } })
    if (!driver) continue

    // Enrich with custom bonuses and deductions
    raw.customBonuses = customBonuses.map(b => ({ name: b.name, nameAr: b.nameAr, amount: b.amount }))
    raw.customDeductions = customDeductions.map(d => ({ name: d.name, nameAr: d.nameAr, amount: d.amount }))

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

    // Generate exceptions for flagged drivers
    if (result.varianceStatus === 'major') {
      await db.payrollException.create({
        data: {
          payrollRunId: payrollRun.id,
          code: 'MAJOR_VARIANCE',
          severity: 'error',
          source: 'variance_check',
          rowRef: result.riderId,
          message: `${result.driverName}: variance SAR ${result.varianceAmount.toFixed(2)} (${result.variancePercentage.toFixed(2)}%) exceeds major threshold`,
          suggestedAction: 'Review calculation vs uploaded basic payment',
        },
      })
    }
    if (result.reviewStatus === 'flagged') {
      await db.payrollException.create({
        data: {
          payrollRunId: payrollRun.id,
          code: 'REVIEW_FLAGGED',
          severity: 'warning',
          source: 'review_check',
          rowRef: result.riderId,
          message: `${result.driverName}: flagged for review (penalties > threshold or negative salary)`,
          suggestedAction: 'Manual review required before payslip generation',
        },
      })
    }
  }

  await db.payrollRun.update({
    where: { id: payrollRun.id },
    data: {
      totalDrivers: parsed.drivers.length,
      totalGross,
      totalPenalties,
      totalNet,
      totalVariance,
      totalTraffic,
    },
  })

  // 7. Sample traffic violations for demo
  const drivers = await db.driver.findMany()
  if (drivers.length > 0) {
    const samples = [
      { riderId: drivers[0].riderId, type: 'Speeding', amount: 300, daysAgo: 5 },
      { riderId: drivers[1].riderId, type: 'Parking', amount: 150, daysAgo: 12 },
      { riderId: drivers[2].riderId, type: 'Red Light', amount: 500, daysAgo: 3 },
    ]
    for (const s of samples) {
      const drv = await db.driver.findUnique({ where: { riderId: s.riderId } })
      if (!drv) continue
      await db.trafficViolation.create({
        data: {
          driverId: drv.id,
          riderId: s.riderId,
          ticketDate: new Date(Date.now() - s.daysAgo * 86400000),
          violationType: s.type,
          amount: s.amount,
          status: 'approved',
          notes: `Sample ${s.type} violation for demo`,
        },
      })
    }
    console.log(`Created ${samples.length} sample traffic violations`)
  }

  // 8. Audit log for import
  await db.auditLog.create({
    data: {
      action: 'import',
      entityType: 'payroll_run',
      entityId: payrollRun.id,
      ruleSetId: activeRules.ruleSetId,
      description: `Seeded May 2026 payroll run with ${parsed.drivers.length} drivers`,
      metadata: JSON.stringify({ fileName: payrollRun.fileName, driverCount: parsed.drivers.length }),
    },
  })

  console.log('=== Seed complete ===')
  console.log(`Payroll run: ${payrollRun.id}`)
  console.log(`Total drivers: ${parsed.drivers.length}`)
  console.log(`Total gross: SAR ${totalGross.toFixed(2)}`)
  console.log(`Total net:   SAR ${totalNet.toFixed(2)}`)
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
