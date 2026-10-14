// Seed default expense categories for the Income vs Expenses module
import { db } from '../src/lib/db'

const DEFAULT_CATEGORIES = [
  { name: 'Iqama', nameAr: 'الإقامة', defaultAmount: 1000, allocationType: 'per_driver', description: 'Iqama renewal fee per driver' },
  { name: 'Petrol', nameAr: 'البنزين', defaultAmount: 1200, allocationType: 'per_driver', description: 'Monthly petrol allowance per driver' },
  { name: 'Car rent', nameAr: 'إيجار السيارة', defaultAmount: 1500, allocationType: 'per_driver', description: 'Monthly car rent per driver' },
  { name: 'Internet', nameAr: 'الإنترنت', defaultAmount: 115, allocationType: 'per_driver', description: 'Monthly internet allowance per driver' },
  { name: 'Office', nameAr: 'المكتب', defaultAmount: 18000, allocationType: 'shared', description: 'Monthly office rent (shared across all drivers)' },
  { name: 'Accommodation / flat', nameAr: 'السكن', defaultAmount: 12000, allocationType: 'shared', description: 'Monthly accommodation (shared across all drivers)' },
  { name: 'Saudis salary and insurance', nameAr: 'رواتب وتأمين السعوديين', defaultAmount: 12900, allocationType: 'shared', description: 'Monthly Saudis salary and insurance (shared)' },
  { name: 'Electricity and water', nameAr: 'الكهرباء والماء', defaultAmount: 1000, allocationType: 'shared', description: 'Monthly electricity and water (shared)' },
]

async function main() {
  console.log('=== Seeding expense categories ===')
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await db.expenseCategory.findUnique({ where: { name: cat.name } })
    if (existing) {
      await db.expenseCategory.update({ where: { id: existing.id }, data: cat })
      console.log(`Updated: ${cat.name}`)
    } else {
      await db.expenseCategory.create({ data: cat })
      console.log(`Created: ${cat.name}`)
    }
  }
  console.log('=== Done ===')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
