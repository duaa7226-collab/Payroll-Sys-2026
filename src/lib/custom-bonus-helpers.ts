// Custom bonuses helper — fetches active custom bonuses from Rules Control Center
import { db } from './db'

export interface CustomBonusItem {
  id: string
  name: string
  nameAr: string | null
  amount: number
  type: string
}

export async function getActiveCustomBonuses(): Promise<CustomBonusItem[]> {
  const bonuses = await db.customBonus.findMany({
    where: { status: 'active' },
  })
  return bonuses.map(b => ({
    id: b.id,
    name: b.name,
    nameAr: b.nameAr,
    amount: b.amount,
    type: b.type,
  }))
}
