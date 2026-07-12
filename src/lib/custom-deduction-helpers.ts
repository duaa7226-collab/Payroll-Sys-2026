import { db } from './db'

export interface CustomDeductionItem {
  id: string
  name: string
  nameAr: string | null
  amount: number
}

export async function getActiveCustomDeductions(): Promise<CustomDeductionItem[]> {
  const deductions = await db.customDeduction.findMany({ where: { status: 'active' } })
  return deductions.map(d => ({ id: d.id, name: d.name, nameAr: d.nameAr, amount: d.amount }))
}
