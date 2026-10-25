// Shared payroll persistence helpers.
//
// Import, full recalculation and single-driver edits all used to duplicate the
// input reconstruction and the ~50-column DriverResult mapping. Keeping one
// implementation guarantees the three paths produce identical numbers.
import type { DriverResultCalc, RawDriverData } from './salary-engine'
import type { CustomBonusItem } from './custom-bonus-helpers'
import type { CustomDeductionItem } from './custom-deduction-helpers'
import type { ManualAdjustmentBreakdown } from './manual-adjustment-helpers'

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Run async tasks with bounded concurrency (keeps remote poolers happy). */
export async function runWithConcurrency(tasks: Array<() => Promise<unknown>>, limit = 10): Promise<void> {
  if (tasks.length === 0) return
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++
      await tasks[index]()
    }
  })
  await Promise.all(workers)
}

export function sumTotals(results: DriverResultCalc[]) {
  let totalGross = 0
  let totalPenalties = 0
  let totalNet = 0
  let totalVariance = 0
  let totalTraffic = 0
  for (const result of results) {
    totalGross += result.grossSalaryBeforePenalties
    totalPenalties += result.totalOtherPenalties
    totalNet += result.finalNetSalary
    totalVariance += Math.abs(result.varianceAmount)
    totalTraffic += result.trafficViolationsDeduction
  }
  return { totalGross, totalPenalties, totalNet, totalVariance, totalTraffic }
}

/** DriverResult row payload for a computed result. */
export function driverResultCreateData(payrollRunId: string, driverId: string, result: DriverResultCalc) {
  return {
    payrollRunId,
    driverId,
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
  }
}

/** Exceptions raised for a driver by the calculation (variance / review). */
export function driverExceptionRows(
  payrollRunId: string,
  result: DriverResultCalc
): Array<{
  payrollRunId: string
  code: string
  severity: string
  source: string
  rowRef: string
  message: string
  suggestedAction: string
}> {
  const rows: Array<{
    payrollRunId: string
    code: string
    severity: string
    source: string
    rowRef: string
    message: string
    suggestedAction: string
  }> = []
  if (result.varianceStatus === 'major') {
    rows.push({
      payrollRunId,
      code: 'MAJOR_VARIANCE',
      severity: 'error',
      source: 'variance_check',
      rowRef: result.riderId,
      message: `${result.driverName}: variance SAR ${result.varianceAmount.toFixed(2)} (${result.variancePercentage.toFixed(2)}%) exceeds major threshold`,
      suggestedAction: 'Review calculation vs uploaded basic payment',
    })
  }
  if (result.reviewStatus === 'flagged') {
    rows.push({
      payrollRunId,
      code: 'REVIEW_FLAGGED',
      severity: 'warning',
      source: 'review_check',
      rowRef: result.riderId,
      message: `${result.driverName}: flagged for review (penalties over threshold, deductions over salary, or major variance)`,
      suggestedAction: 'Manual review required before payslip generation',
    })
  }
  return rows
}

/** Stored penaltiesJson uses short keys; the salary engine expects long keys. */
export function penaltiesFromStored(json: string | null | undefined): Record<string, number> {
  let stored: Record<string, number> = {}
  try {
    stored = JSON.parse(json || '{}') || {}
  } catch {
    stored = {}
  }
  const abs = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? Math.abs(n) : 0
  }
  return {
    acceptance_rate_penalties: abs(stored.acceptance),
    contact_rate_penalties: abs(stored.contact),
    stacking_deduction: abs(stored.stacking),
    declined_penalties_day_logic: abs(stored.declined),
    late_penalty: abs(stored.late),
    no_show_penalty: abs(stored.noshow),
    no_show_penalty_special_cities: abs(stored.noshow_special),
    daily_acceptance_rate_penalty: abs(stored.daily_acceptance),
    distance_payment: abs(stored.distance),
    missed_days_penalty: abs(stored.missed_days),
    segment_payment: abs(stored.segment),
  }
}

export interface CalculationSources {
  trafficByRider: Map<string, { total: number }>
  manualByRider: Map<string, ManualAdjustmentBreakdown>
  customBonuses: CustomBonusItem[]
  customDeductions: CustomDeductionItem[]
  riderBonuses: (riderId: string) => Array<{ name: string; nameAr: string | null; amount: number }>
  riderDeductions: (riderId: string) => Array<{ name: string; nameAr: string | null; amount: number; monthlyDeduction: number }>
}

function withoutStoredCarTga(penalties: Record<string, number>, json: string | null | undefined) {
  // car_deduction / tga_deduction / rider_balance live as separate columns in
  // the stored payload, so read them from the raw JSON.
  let stored: Record<string, number> = {}
  try {
    stored = JSON.parse(json || '{}') || {}
  } catch {}
  const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0))
    return Number.isFinite(n) ? Math.abs(n) : 0
  }
  return {
    penalties,
    carDeduction: num(stored.car_deduction),
    tgaDeduction: num(stored.tga_deduction),
    riderBalance: num(stored.rider_balance),
  }
}

/** Rebuild the engine input from a stored DriverResult. */
export function buildRawFromResult(
  existing: any,
  sources: CalculationSources,
  overrides: Partial<RawDriverData> = {}
): RawDriverData {
  const { penalties, carDeduction, tgaDeduction, riderBalance } = withoutStoredCarTga(
    penaltiesFromStored(existing.penaltiesJson),
    existing.penaltiesJson
  )

  return {
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
    penalties,
    carDeduction,
    tgaDeduction,
    riderBalance,
    segmentPayment: existing.segmentPayment || 0,
    trafficViolationsTotal: sources.trafficByRider.get(existing.riderId)?.total ?? 0,
    customBonuses: sources.riderBonuses(existing.riderId),
    customDeductions: sources.riderDeductions(existing.riderId),
    manualBonuses: (sources.manualByRider.get(existing.riderId)?.bonuses ?? []).map(b => ({
      title: b.title,
      titleAr: b.titleAr,
      amount: b.amount,
    })),
    manualDeductions: (sources.manualByRider.get(existing.riderId)?.deductions ?? []).map(d => ({
      title: d.title,
      titleAr: d.titleAr,
      amount: d.amount,
    })),
    ...overrides,
  }
}
