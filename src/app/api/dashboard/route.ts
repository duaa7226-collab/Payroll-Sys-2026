import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { calculateIncome, calculateExpensesFromList, getActiveDriverCount } from '@/lib/income-expenses-engine'

// GET /api/dashboard — executive dashboard KPIs + charts data + income/expense summary
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
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
  const totalBonus = results.reduce((a, r) => a + r.bonusAmount, 0)
  const totalMissingDeduction = results.reduce((a, r) => a + r.missingOrderDeduction, 0)
  const totalWorkingHours = results.reduce((a, r) => a + r.workingHours, 0)
  const driversRequiringReview = results.filter(r => r.reviewStatus !== 'ok').length
  const highestPaid = results[0] ?? null
  const highestPenalty = [...results].sort((a, b) => b.totalOtherPenalties - a.totalOtherPenalties)[0] ?? null

  // ====== Fetch income + expenses for the same month ======
  const monthMap: Record<string, string> = {
    'jan':'01','january':'01','feb':'02','february':'02','mar':'03','march':'03','apr':'04','april':'04',
    'may':'05','jun':'06','june':'06','jul':'07','july':'07','aug':'08','august':'08',
    'sep':'09','sept':'09','september':'09','oct':'10','october':'10','nov':'11','november':'11','dec':'12','december':'12',
  }
  const labelParts = payrollRun.payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
  let monthKey = ''
  for (let i = 0; i < labelParts.length; i++) {
    const m = monthMap[labelParts[i]]
    if (m) {
      const y = labelParts.find(p => /^\d{4}$/.test(p)) || String(new Date().getFullYear())
      monthKey = `${y}-${m}`
      break
    }
  }

  let incomeExpenseSummary: any = null
  if (monthKey) {
    try {
      const activeDriverCount = await getActiveDriverCount(monthKey)
      const incomeRecords = await db.incomeRecord.findMany({ where: { month: monthKey } })
      const expenses = await db.expense.findMany({ where: { month: monthKey } })

      // Read WR Amount Excl. VAT from payroll run's ruleSnapshot
      let wrAmountExclVAT = 0
      try {
        const snapshot = JSON.parse(payrollRun.ruleSnapshot || '{}')
        wrAmountExclVAT = snapshot.wrAmountExclVAT || 0
      } catch {}

      if (incomeRecords.length > 0 || wrAmountExclVAT > 0) {
        let totalIncome = 0
        let totalExpenses = 0
        let profitableCount = 0
        for (const rec of incomeRecords) {
          const income = calculateIncome(rec)
          const expAlloc = calculateExpensesFromList(expenses, rec.riderId, activeDriverCount)
          totalIncome += income.totalIncome
          totalExpenses += expAlloc.totalExpenses
          if (income.totalIncome - expAlloc.totalExpenses > 0) profitableCount++
        }
        // Override total income with WR "Amount Excl. VAT" if available
        if (wrAmountExclVAT > 0) {
          totalIncome = wrAmountExclVAT
        }
        const totalNetProfit = totalIncome - totalExpenses

        const expenseByCategoryMap = new Map<string, number>()
        for (const e of expenses) {
          expenseByCategoryMap.set(e.categoryName, (expenseByCategoryMap.get(e.categoryName) ?? 0) + e.amount)
        }
        const perDriverExp = expenses.filter(e => e.allocationType === 'per_driver').reduce((s, e) => s + e.amount, 0)
        const sharedExp = expenses.filter(e => e.allocationType === 'shared').reduce((s, e) => s + e.amount, 0)
        const assignedExp = expenses.filter(e => e.allocationType === 'assigned').reduce((s, e) => s + e.amount, 0)

        incomeExpenseSummary = {
          month: monthKey,
          activeDriverCount,
          totalIncome,
          totalExpenses,
          totalNetProfit,
          avgNetPerDriver: activeDriverCount > 0 ? totalNetProfit / activeDriverCount : 0,
          profitableCount,
          unprofitableCount: incomeRecords.length - profitableCount,
          perDriverExp,
          sharedExp,
          assignedExp,
          expenseByCategory: Array.from(expenseByCategoryMap.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
        }
      }
    } catch (e) {
      console.error('Dashboard income/expense fetch failed:', e)
    }
  }

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
  for (const r of results) bandCounts[r.performanceBand] = (bandCounts[r.performanceBand] ?? 0) + 1

  const varianceCounts: Record<string, number> = { ok: 0, minor: 0, major: 0, review: 0 }
  for (const r of results) varianceCounts[r.varianceStatus] = (varianceCounts[r.varianceStatus] ?? 0) + 1

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

  // Report the rules the RUN was calculated with (its immutable snapshot), not
  // the currently active set — otherwise the header disagrees with the results
  // whenever an administrator edits rules without recalculating.
  const activeRules = await getActiveRuleSnapshot()
  let runRules: Record<string, any> = activeRules.snapshot as any
  try {
    const parsedSnapshot = JSON.parse(payrollRun.ruleSnapshot || '{}')
    if (parsedSnapshot && typeof parsedSnapshot === 'object' && Object.keys(parsedSnapshot).length > 0) {
      runRules = parsedSnapshot
    }
  } catch {}

  const stdDays = Number(runRules.standard_working_days) || 0
  const monthlyTarget = Number(runRules.monthly_target_orders) || 0
  const monthlyBase = Number(runRules.monthly_base_salary) || 0
  const ruleSummary = {
    ruleSetName: payrollRun.ruleSet?.name || activeRules.ruleSetName,
    salaryMode: runRules.salary_mode,
    monthlyBaseSalary: runRules.monthly_base_salary,
    standardWorkingDays: runRules.standard_working_days,
    monthlyTargetOrders: runRules.monthly_target_orders,
    dailyTargetRate: stdDays > 0 ? monthlyTarget / stdDays : 0,
    salaryPerOrderRate: monthlyTarget > 0 ? monthlyBase / monthlyTarget : 0,
    bonusPerExtraOrder: runRules.bonus_per_extra_order,
    deductionPerMissingOrder: runRules.deduction_per_missing_order,
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
      totalBonus,
      totalMissingDeduction,
      totalWorkingHours,
      driversRequiringReview,
      highestPaidDriver: highestPaid ? { name: highestPaid.driverName, amount: highestPaid.finalNetSalary } : null,
      highestPenaltyDriver: highestPenalty ? { name: highestPenalty.driverName, amount: highestPenalty.totalOtherPenalties } : null,
    },
    incomeExpense: incomeExpenseSummary,
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
