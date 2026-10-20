import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { parseWorkbook } from '@/lib/excel-parser'
import { calculateDriverSalary } from '@/lib/salary-engine'
import { getAllRiderTrafficDeductions } from '@/lib/traffic-helpers'
import * as fs from 'fs'
import * as path from 'path'

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

    // Save uploaded file to disk for future reference (sync, audit, etc.)
    try {
      const uploadDir = '/home/z/my-project/upload'
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const savePath = path.join(uploadDir, safeName)
      fs.writeFileSync(savePath, buffer)
    } catch (e) {
      console.warn('Could not save uploaded file to disk:', e)
    }

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

    // Get traffic violations per driver (installment-aware: only counts monthly portion)
    const allRiderIds = parsed.drivers.map(d => d.riderId)
    const trafficByRider = await getAllRiderTrafficDeductions(allRiderIds)

    // Enrich raw drivers with traffic violations
    for (const d of parsed.drivers) {
      d.trafficViolationsTotal = trafficByRider.get(d.riderId)?.total ?? 0
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
      // Pick per-driver banking from RLVL if available; otherwise use aggregate (RLVL or WR fallback)
      const perDriverBanking = parsed.driverBanking?.[raw.riderId]
      const beneficiaryName = perDriverBanking?.beneficiaryName || parsed.banking?.beneficiaryName || null
      const iban = perDriverBanking?.iban || parsed.banking?.iban || null
      const bankName = perDriverBanking?.bankName || parsed.banking?.bankName || null

      const driver = await db.driver.upsert({
        where: { riderId: raw.riderId },
        create: {
          riderId: raw.riderId,
          name: raw.name,
          contractName: raw.contractName,
          vehicleType: raw.vehicleType,
          beneficiaryName,
          iban,
          bankName,
        },
        update: {
          name: raw.name,
          contractName: raw.contractName,
          vehicleType: raw.vehicleType,
          beneficiaryName,
          iban,
          bankName,
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

    // ====== AUTO-SYNC income data + default expenses for the Income vs Expenses module ======
    // This ensures the dashboard KPIs (Income, Expenses, Net Profit) show immediately after import
    try {
      const monthMap: Record<string, string> = {
        'jan':'01','january':'01','feb':'02','february':'02','mar':'03','march':'03','apr':'04','april':'04',
        'may':'05','jun':'06','june':'06','jul':'07','july':'07','aug':'08','august':'08',
        'sep':'09','sept':'09','september':'09','oct':'10','october':'10','nov':'11','november':'11','dec':'12','december':'12',
      }
      const labelParts = payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
      let incomeMonth = ''
      for (let i = 0; i < labelParts.length; i++) {
        const m = monthMap[labelParts[i]]
        if (m) {
          const y = labelParts.find(p => /^\d{4}$/.test(p)) || String(new Date().getFullYear())
          incomeMonth = `${y}-${m}`
          break
        }
      }
      if (!incomeMonth) incomeMonth = new Date().toISOString().slice(0, 7)

      const company = 'HungerStation'
      // Clear existing income records for this month/company
      await db.incomeRecord.deleteMany({ where: { month: incomeMonth, companyName: company } })

      // Create income records from DriverResult data
      for (const raw of parsed.drivers) {
        const driver = await db.driver.findUnique({ where: { riderId: raw.riderId } })
        const dr = await db.driverResult.findFirst({ where: { payrollRunId: payrollRun.id, riderId: raw.riderId } })
        if (!dr) continue
        const penalties = JSON.parse(dr.penaltiesJson || '{}')

        const incomeData = {
          driverId: driver?.id || null,
          driverName: dr.driverName,
          companyName: company,
          basicPayment: dr.uploadedBasicPayment || 0,
          distancePayment: penalties.distance || 0,
          segmentPayment: penalties.segment || 0,
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
          sourceFile: file.name,
          importedBy: 'auto-sync',
        }
        const { calculateIncome } = await import('@/lib/income-expenses-engine')
        const calc = calculateIncome(incomeData)
        await db.incomeRecord.create({
          data: { month: incomeMonth, riderId: raw.riderId, ...incomeData, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties },
        })
      }

      // Set driver count
      await db.driverCount.upsert({
        where: { month: incomeMonth },
        create: { month: incomeMonth, activeDriverCount: parsed.drivers.length, notes: `Auto-synced from ${payrollMonth}`, confirmedBy: 'auto-sync' },
        update: { activeDriverCount: parsed.drivers.length, notes: `Auto-synced from ${payrollMonth}`, confirmedBy: 'auto-sync' },
      })

      // Auto-seed default expenses
      const DEFAULT_EXPENSES = [
        { name: 'Iqama', amount: 1000, type: 'per_driver' },
        { name: 'Petrol', amount: 1200, type: 'per_driver' },
        { name: 'Car rent', amount: 1500, type: 'per_driver' },
        { name: 'Internet', amount: 115, type: 'per_driver' },
        { name: 'Office', amount: 18000, type: 'shared' },
        { name: 'Accommodation / flat', amount: 12000, type: 'shared' },
        { name: 'Saudis salary and insurance', amount: 12900, type: 'shared' },
        { name: 'Electricity and water', amount: 1000, type: 'shared' },
      ]
      const existingExp = await db.expense.findMany({ where: { month: incomeMonth }, select: { categoryName: true } })
      const existingCats = new Set(existingExp.map(e => e.categoryName))
      const allCats = await db.expenseCategory.findMany()
      for (const def of DEFAULT_EXPENSES) {
        if (!existingCats.has(def.name)) {
          let cat = allCats.find(c => c.name === def.name)
          if (!cat) cat = await db.expenseCategory.create({ data: { name: def.name, defaultAmount: def.amount, allocationType: def.type } })
          await db.expense.create({ data: { month: incomeMonth, categoryId: cat.id, categoryName: cat.name, amount: def.amount, allocationType: def.type, notes: 'Auto-seeded during import', createdBy: 'auto-sync' } })
        }
      }
      console.log(`Auto-synced ${parsed.drivers.length} income records + default expenses for ${incomeMonth}`)
    } catch (syncErr) {
      console.error('Auto-sync income/expenses failed (non-fatal):', syncErr)
    }

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
