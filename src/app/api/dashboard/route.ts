import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'

// GET /api/dashboard — executive dashboard KPIs + charts data
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')

  let payrollRun
  if (runId) {
    payrollRun = await db.payrollRun.findUnique({
      where: { id: runId },
      include: { ruleSet: true },
    })
  }
  if (!payrollRun) {
    payrollRun = await db.payrollRun.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { ruleSet: true },
    })
  }

  if (!payrollRun) {
    return NextResponse.json({ error: 'No payroll runs found' }, { status: 404 })
  }

  const results = await db.driverResult.findMany({
    where: { payrollRunId: payrollRun.id },
    orderBy: { finalNetSalary: 'desc' },
  })

  const totalDrivers = results.length
  const totalCompletedOrders = results.reduce((a, r) => a + r.completedOrders, 0)
  const totalWorkingDays = results.reduce((a, r) => a + r.actualWorkingDays, 0)
  const totalGross = results.reduce((a, r) => a + r.grossSalaryBeforePenalties, 0)
  const totalPenalties = results.reduce((a, r) => a + r.totalOtherPenalties, 0)
  const totalNet = results.reduce((a, r) => a + r.finalNetSalary, 0)
  const totalVariance = results.reduce((a, r) => a + Math.abs(r.varianceAmount), 0)
  const totalTraffic = results.reduce((a, r) => a + r.trafficViolationsDeduction, 0)
  const driversRequiringReview = results.filter(r => r.reviewStatus !== 'ok').length
  const highestPaid = results[0] ?? null
  const highestPenalty = [...results].sort((a, b) => b.totalOtherPenalties - a.totalOtherPenalties)[0] ?? null

  const contractMap = new Map<string, { contract: string; drivers: number; net: number; gross: number; orders: number; penalties: number }>()
  for (const r of results) {
    const c = contractMap.get(r.contractName) ?? { contract: r.contractName, drivers: 0, net: 0, gross: 0, orders: 0, penalties: 0 }
    c.drivers += 1
    c.net += r.finalNetSalary
    c.gross += r.grossSalaryBeforePenalties
    c.orders += r.completedOrders
    c.penalties += r.totalOtherPenalties
    contractMap.set(r.contractName, c)
  }
  const byContract = Array.from(contractMap.values())

  const top10 = results.slice(0, Math.min(10, results.length))
  const bottom10 = [...results].reverse().slice(0, Math.min(10, results.length))

  const penaltyTotals: Record<string, number> = {}
  for (const r of results) {
    try {
      const p = JSON.parse(r.penaltiesJson)
      for (const [k, v] of Object.entries(p)) {
        penaltyTotals[k] = (penaltyTotals[k] ?? 0) + (v as number)
      }
    } catch {}
  }

  const bandCounts: Record<string, number> = { top: 0, high: 0, average: 0, low: 0, bottom: 0 }
  for (const r of results) bandCounts[r.performanceBand] += 1

  const varianceCounts: Record<string, number> = { ok: 0, minor: 0, major: 0, review: 0 }
  for (const r of results) varianceCounts[r.varianceStatus] += 1

  const ordersVsTarget = results.map(r => ({
    name: r.driverName,
    riderId: r.riderId,
    completed: r.completedOrders,
    target: r.selectedTargetThreshold,
    net: r.finalNetSalary,
  }))

  const workingDaysVsNet = results.map(r => ({
    name: r.driverName,
    workingDays: r.actualWorkingDays,
    net: r.finalNetSalary,
  }))

  const activeRules = await getActiveRuleSnapshot()
  const ruleSummary = {
    ruleSetName: activeRules.ruleSetName,
    salaryMode: activeRules.snapshot.salary_mode,
    monthlyBaseSalary: activeRules.snapshot.monthly_base_salary,
    standardWorkingDays: activeRules.snapshot.standard_working_days,
    monthlyTargetOrders: activeRules.snapshot.monthly_target_orders,
    dailyTargetRate: (activeRules.snapshot.monthly_target_orders as number) / (activeRules.snapshot.standard_working_days as number),
    salaryPerOrderRate: (activeRules.snapshot.monthly_base_salary as number) / (activeRules.snapshot.monthly_target_orders as number),
    bonusPerExtraOrder: activeRules.snapshot.bonus_per_extra_order,
    deductionPerMissingOrder: activeRules.snapshot.deduction_per_missing_order,
  }

  const allRuns = await db.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      payrollMonth: true,
      fileName: true,
      createdAt: true,
      totalDrivers: true,
      totalNet: true,
      status: true,
    },
  })

  return NextResponse.json({
    run: {
      id: payrollRun.id,
      payrollMonth: payrollRun.payrollMonth,
      fileName: payrollRun.fileName,
      createdAt: payrollRun.createdAt,
      status: payrollRun.status,
    },
    allRuns,
    kpis: {
      totalDrivers,
      totalContracts: byContract.length,
      totalWorkingDays,
      totalCompletedOrders,
      totalGross,
      totalPenalties,
      totalNet,
      totalVariance,
      totalTraffic,
      driversRequiringReview,
      highestPaidDriver: highestPaid ? { name: highestPaid.driverName, amount: highestPaid.finalNetSalary } : null,
      highestPenaltyDriver: highestPenalty ? { name: highestPenalty.driverName, amount: highestPenalty.totalOtherPenalties } : null,
    },
    charts: {
      byContract,
      top10: top10.map(r => ({ name: r.driverName, net: r.finalNetSalary, gross: r.grossSalaryBeforePenalties })),
      bottom10: bottom10.map(r => ({ name: r.driverName, net: r.finalNetSalary, gross: r.grossSalaryBeforePenalties })),
      penaltyBreakdown: Object.entries(penaltyTotals)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => ({ type: k, amount: v }))
        .sort((a, b) => b.amount - a.amount),
      performanceBands: Object.entries(bandCounts).map(([band, count]) => ({ band, count })),
      varianceStatus: Object.entries(varianceCounts).map(([status, count]) => ({ status, count })),
      ordersVsTarget,
      workingDaysVsNet,
      trafficByDriver: results
        .filter(r => r.trafficViolationsDeduction > 0)
        .map(r => ({ name: r.driverName, amount: r.trafficViolationsDeduction })),
    },
    ruleSummary,
  })
}
