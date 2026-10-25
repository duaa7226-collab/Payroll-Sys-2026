import { db } from './db'
import { parseStringArray } from './utils'

export interface CustomBonusItem {
  id: string
  name: string
  nameAr: string | null
  amount: number
  type: string
  applyToAll: boolean
  targetRiderIds: string[]
}

export async function getActiveCustomBonuses(): Promise<CustomBonusItem[]> {
  const bonuses = await db.customBonus.findMany({ where: { status: 'active' } })
  return bonuses.map(b => ({
    id: b.id, name: b.name, nameAr: b.nameAr, amount: b.amount, type: b.type,
    applyToAll: b.applyToAll,
    targetRiderIds: parseStringArray(b.targetRiderIds),
  }))
}

// Get custom bonuses applicable to a specific rider
export function getBonusesForRider(bonuses: CustomBonusItem[], riderId: string): CustomBonusItem[] {
  return bonuses.filter(b => b.applyToAll || b.targetRiderIds.includes(riderId))
}
