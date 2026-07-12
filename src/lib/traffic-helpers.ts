// Traffic deduction helper — calculates one-time + active installment deductions per rider
import { db } from './db'

export interface TrafficDeductionBreakdown {
  oneTimeTotal: number
  installmentMonthlyTotal: number
  total: number
  installments: Array<{
    id: string
    violationType: string
    originalAmount: number
    monthlyAmount: number
    totalPaid: number
    remainingBalance: number
    remainingMonths: number
  }>
}

export async function getRiderTrafficDeduction(riderId: string): Promise<TrafficDeductionBreakdown> {
  const violations = await db.trafficViolation.findMany({
    where: { riderId, status: 'approved' },
  })

  let oneTimeTotal = 0
  let installmentMonthlyTotal = 0
  const installments: TrafficDeductionBreakdown['installments'] = []

  for (const v of violations) {
    if (v.installmentEnabled && v.installmentStatus === 'active') {
      const remaining = Math.max(0, v.amount - v.installmentTotalPaid)
      if (remaining > 0) {
        const monthlyDeduction = Math.min(v.installmentMonthlyAmount, remaining)
        installmentMonthlyTotal += monthlyDeduction
        installments.push({
          id: v.id, violationType: v.violationType, originalAmount: v.amount,
          monthlyAmount: monthlyDeduction, totalPaid: v.installmentTotalPaid,
          remainingBalance: remaining, remainingMonths: Math.ceil(remaining / monthlyDeduction),
        })
      }
    } else {
      oneTimeTotal += v.amount
    }
  }

  return { oneTimeTotal, installmentMonthlyTotal, total: oneTimeTotal + installmentMonthlyTotal, installments }
}

export async function getAllRiderTrafficDeductions(riderIds: string[]): Promise<Map<string, TrafficDeductionBreakdown>> {
  const violations = await db.trafficViolation.findMany({
    where: { riderId: { in: riderIds }, status: 'approved' },
  })

  const byRider = new Map<string, TrafficDeductionBreakdown>()

  for (const v of violations) {
    let breakdown = byRider.get(v.riderId)
    if (!breakdown) {
      breakdown = { oneTimeTotal: 0, installmentMonthlyTotal: 0, total: 0, installments: [] }
      byRider.set(v.riderId, breakdown)
    }

    if (v.installmentEnabled && v.installmentStatus === 'active') {
      const remaining = Math.max(0, v.amount - v.installmentTotalPaid)
      if (remaining > 0) {
        const monthlyDeduction = Math.min(v.installmentMonthlyAmount, remaining)
        breakdown.installmentMonthlyTotal += monthlyDeduction
        breakdown.installments.push({
          id: v.id, violationType: v.violationType, originalAmount: v.amount,
          monthlyAmount: monthlyDeduction, totalPaid: v.installmentTotalPaid,
          remainingBalance: remaining, remainingMonths: Math.ceil(remaining / monthlyDeduction),
        })
      }
    } else {
      breakdown.oneTimeTotal += v.amount
    }
  }

  for (const [, b] of byRider) { b.total = b.oneTimeTotal + b.installmentMonthlyTotal }

  return byRider
}

export async function processInstallmentDeductions(riderIds: string[]): Promise<number> {
  let totalDeducted = 0

  for (const riderId of riderIds) {
    const activeInstallments = await db.trafficViolation.findMany({
      where: { riderId, installmentEnabled: true, installmentStatus: 'active', status: 'approved' },
    })

    for (const v of activeInstallments) {
      const remaining = Math.max(0, v.amount - v.installmentTotalPaid)
      if (remaining <= 0) {
        await db.trafficViolation.update({ where: { id: v.id }, data: { installmentStatus: 'completed' } })
        continue
      }

      const monthlyDeduction = Math.min(v.installmentMonthlyAmount, remaining)
      const newTotalPaid = v.installmentTotalPaid + monthlyDeduction
      const newStatus = newTotalPaid >= v.amount ? 'completed' : 'active'

      await db.trafficViolation.update({
        where: { id: v.id },
        data: { installmentTotalPaid: newTotalPaid, installmentStatus: newStatus },
      })

      totalDeducted += monthlyDeduction
    }
  }

  return totalDeducted
}
