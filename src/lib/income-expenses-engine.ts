// Income vs Expenses calculation engine
import { db } from './db'

export interface IncomeCalc {
  basicPayment: number
  distancePayment: number
  segmentPayment: number
  // All penalties treated as deductions (use absolute values)
  totalPenalties: number
  riderBalance: number // signed
  customFieldsTotal: number // net of custom add/deduct fields
  totalIncome: number
}

export interface ExpenseAllocation {
  perDriverTotal: number
  sharedTotal: number
  assignedTotal: number
  totalExpenses: number
  sharedBreakdown: Array<{ categoryName: string; totalAmount: number; perDriver: number }>
  perDriverBreakdown: Array<{ categoryName: string; amount: number }>
  assignedBreakdown: Array<{ categoryName: string; amount: number; riderId: string | null }>
}

export interface DriverNetResult {
  income: IncomeCalc
  expenses: ExpenseAllocation
  netProfit: number
}

// Calculate income from an IncomeRecord row
export function calculateIncome(rec: {
  basicPayment: number
  distancePayment: number
  segmentPayment: number
  acceptancePenalty: number
  contactPenalty: number
  stackingDeduction: number
  declinedPenalty: number
  latePenalty: number
  noShowPenalty: number
  noShowSpecialPenalty: number
  dailyAcceptancePenalty: number
  missedDaysPenalty: number
  riderBalance: number
  customFieldsJson?: string | null
}): IncomeCalc {
  const totalPenalties =
    Math.abs(rec.acceptancePenalty) +
    Math.abs(rec.contactPenalty) +
    Math.abs(rec.stackingDeduction) +
    Math.abs(rec.declinedPenalty) +
    Math.abs(rec.latePenalty) +
    Math.abs(rec.noShowPenalty) +
    Math.abs(rec.noShowSpecialPenalty) +
    Math.abs(rec.dailyAcceptancePenalty) +
    Math.abs(rec.missedDaysPenalty)

  // Custom fields
  let customFieldsTotal = 0
  if (rec.customFieldsJson) {
    try {
      const fields = JSON.parse(rec.customFieldsJson) as Array<{ name: string; amount: number; type: 'add' | 'deduct' }>
      for (const f of fields) {
        if (f.type === 'deduct') customFieldsTotal -= Math.abs(f.amount)
        else customFieldsTotal += Math.abs(f.amount)
      }
    } catch {}
  }

  // Total income = basic + distance + segment - penalties + riderBalance + customFields
  const totalIncome =
    rec.basicPayment +
    rec.distancePayment +
    rec.segmentPayment -
    totalPenalties +
    rec.riderBalance +
    customFieldsTotal

  return {
    basicPayment: rec.basicPayment,
    distancePayment: rec.distancePayment,
    segmentPayment: rec.segmentPayment,
    totalPenalties,
    riderBalance: rec.riderBalance,
    customFieldsTotal,
    totalIncome,
  }
}

// Calculate expense allocation for a single driver in a given month
export async function calculateDriverExpenses(
  month: string,
  riderId: string,
  activeDriverCount: number
): Promise<ExpenseAllocation> {
  const expenses = await db.expense.findMany({ where: { month } })

  const perDriverBreakdown: Array<{ categoryName: string; amount: number }> = []
  const sharedBreakdown: Array<{ categoryName: string; totalAmount: number; perDriver: number }> = []
  const assignedBreakdown: Array<{ categoryName: string; amount: number; riderId: string | null }> = []

  let perDriverTotal = 0
  let sharedTotal = 0
  let assignedTotal = 0

  // Group shared expenses by category (sum amounts if multiple entries)
  const sharedByCategory = new Map<string, number>()
  for (const e of expenses) {
    if (e.allocationType === 'shared') {
      sharedByCategory.set(e.categoryName, (sharedByCategory.get(e.categoryName) ?? 0) + e.amount)
    }
  }

  for (const e of expenses) {
    if (e.allocationType === 'per_driver') {
      // Per-driver expenses apply to ALL active drivers
      perDriverTotal += e.amount
      const existing = perDriverBreakdown.find(p => p.categoryName === e.categoryName)
      if (existing) existing.amount += e.amount
      else perDriverBreakdown.push({ categoryName: e.categoryName, amount: e.amount })
    } else if (e.allocationType === 'shared') {
      // Shared: total ÷ active driver count — handled below
    } else if (e.allocationType === 'assigned') {
      // Assigned to a specific driver
      if (e.assignedRiderId === riderId) {
        assignedTotal += e.amount
        assignedBreakdown.push({ categoryName: e.categoryName, amount: e.amount, riderId: e.assignedRiderId })
      }
    }
  }

  // Shared expenses — divide by active driver count
  const safeDriverCount = activeDriverCount > 0 ? activeDriverCount : 1
  for (const [categoryName, totalAmount] of sharedByCategory.entries()) {
    const perDriver = totalAmount / safeDriverCount
    sharedTotal += perDriver
    sharedBreakdown.push({ categoryName, totalAmount, perDriver })
  }

  const totalExpenses = perDriverTotal + sharedTotal + assignedTotal

  return {
    perDriverTotal,
    sharedTotal,
    assignedTotal,
    totalExpenses,
    sharedBreakdown,
    perDriverBreakdown,
    assignedBreakdown,
  }
}

// Get active driver count for a month (from DriverCount table, fallback to count of income records)
export async function getActiveDriverCount(month: string): Promise<number> {
  const dc = await db.driverCount.findUnique({ where: { month } })
  if (dc && dc.activeDriverCount > 0) return dc.activeDriverCount
  // Fallback: count distinct rider IDs from income records that month
  const records = await db.incomeRecord.findMany({
    where: { month },
    select: { riderId: true },
    distinct: ['riderId'],
  })
  return records.length
}

// Calculate full result for a driver in a month
export async function calculateDriverNet(
  incomeRecord: any,
  month: string,
  activeDriverCount: number
): Promise<DriverNetResult> {
  const income = calculateIncome(incomeRecord)
  const expenses = await calculateDriverExpenses(month, incomeRecord.riderId, activeDriverCount)
  const netProfit = income.totalIncome - expenses.totalExpenses
  return { income, expenses, netProfit }
}
