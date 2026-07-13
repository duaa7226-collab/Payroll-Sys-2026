// Manual adjustments helper — fetches active bonuses and deductions per rider
import { db } from './db'

export interface ManualAdjustmentBreakdown {
  bonuses: Array<{ id: string; title: string; titleAr: string | null; amount: number; category: string }>
  deductions: Array<{ id: string; title: string; titleAr: string | null; amount: number; category: string }>
  bonusTotal: number
  deductionTotal: number
}

export async function getRiderManualAdjustments(riderId: string): Promise<ManualAdjustmentBreakdown> {
  const adjustments = await db.manualAdjustment.findMany({
    where: { riderId, status: 'active' },
  })

  const bonuses: ManualAdjustmentBreakdown['bonuses'] = []
  const deductions: ManualAdjustmentBreakdown['deductions'] = []

  for (const a of adjustments) {
    if (a.type === 'bonus') {
      bonuses.push({ id: a.id, title: a.title, titleAr: a.titleAr, amount: a.amount, category: a.category })
    } else {
      deductions.push({ id: a.id, title: a.title, titleAr: a.titleAr, amount: a.amount, category: a.category })
    }
  }

  return {
    bonuses,
    deductions,
    bonusTotal: bonuses.reduce((a, b) => a + b.amount, 0),
    deductionTotal: deductions.reduce((a, b) => a + b.amount, 0),
  }
}

export async function getAllRiderManualAdjustments(riderIds: string[]): Promise<Map<string, ManualAdjustmentBreakdown>> {
  const adjustments = await db.manualAdjustment.findMany({
    where: { riderId: { in: riderIds }, status: 'active' },
  })

  const byRider = new Map<string, ManualAdjustmentBreakdown>()

  for (const a of adjustments) {
    let breakdown = byRider.get(a.riderId)
    if (!breakdown) {
      breakdown = { bonuses: [], deductions: [], bonusTotal: 0, deductionTotal: 0 }
      byRider.set(a.riderId, breakdown)
    }
    if (a.type === 'bonus') {
      breakdown.bonuses.push({ id: a.id, title: a.title, titleAr: a.titleAr, amount: a.amount, category: a.category })
      breakdown.bonusTotal += a.amount
    } else {
      breakdown.deductions.push({ id: a.id, title: a.title, titleAr: a.titleAr, amount: a.amount, category: a.category })
      breakdown.deductionTotal += a.amount
    }
  }

  return byRider
}
