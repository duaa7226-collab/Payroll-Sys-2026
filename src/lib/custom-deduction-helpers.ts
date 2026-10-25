import { db } from './db'
import { parseStringArray } from './utils'

export interface CustomDeductionItem {
  id: string
  name: string
  nameAr: string | null
  amount: number
  applyToAll: boolean
  targetRiderIds: string[]
  installmentEnabled: boolean
  installmentMonthlyAmount: number
  installmentTotalPaid: number
  installmentStatus: string
  // Computed: amount to deduct this month
  monthlyDeduction: number
}

export async function getActiveCustomDeductions(): Promise<CustomDeductionItem[]> {
  const deductions = await db.customDeduction.findMany({ where: { status: 'active' } })
  return deductions.map(d => {
    const remaining = d.installmentEnabled ? Math.max(0, d.amount - d.installmentTotalPaid) : d.amount
    const monthlyDeduction = d.installmentEnabled && d.installmentStatus === 'active'
      ? Math.min(d.installmentMonthlyAmount, remaining)
      : d.amount
    return {
      id: d.id, name: d.name, nameAr: d.nameAr, amount: d.amount,
      applyToAll: d.applyToAll,
      targetRiderIds: parseStringArray(d.targetRiderIds),
      installmentEnabled: d.installmentEnabled,
      installmentMonthlyAmount: d.installmentMonthlyAmount,
      installmentTotalPaid: d.installmentTotalPaid,
      installmentStatus: d.installmentStatus,
      monthlyDeduction,
    }
  })
}

// Get custom deductions applicable to a specific rider (returns the monthly deduction amount)
export function getDeductionsForRider(deductions: CustomDeductionItem[], riderId: string): CustomDeductionItem[] {
  return deductions.filter(d => d.applyToAll || d.targetRiderIds.includes(riderId))
}

// After a payroll run, update installment totalPaid for all active installment deductions
export async function processCustomDeductionInstallments(): Promise<number> {
  let totalDeducted = 0
  const active = await db.customDeduction.findMany({
    where: { installmentEnabled: true, installmentStatus: 'active', status: 'active' },
  })
  for (const d of active) {
    const remaining = Math.max(0, d.amount - d.installmentTotalPaid)
    if (remaining <= 0) {
      await db.customDeduction.update({ where: { id: d.id }, data: { installmentStatus: 'completed' } })
      continue
    }
    const monthly = Math.min(d.installmentMonthlyAmount, remaining)
    const newTotalPaid = d.installmentTotalPaid + monthly
    const newStatus = newTotalPaid >= d.amount ? 'completed' : 'active'
    await db.customDeduction.update({
      where: { id: d.id },
      data: { installmentTotalPaid: newTotalPaid, installmentStatus: newStatus },
    })
    totalDeducted += monthly
  }
  return totalDeducted
}
