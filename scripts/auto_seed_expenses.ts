// Auto-seed default per-driver expenses (Internet, Iqama, etc.) for any month that has income records but missing expenses
import { db } from '../src/lib/db'

const DEFAULT_PER_DRIVER_EXPENSES = [
  { name: 'Iqama', amount: 1000 },
  { name: 'Petrol', amount: 1200 },
  { name: 'Car rent', amount: 1500 },
  { name: 'Internet', amount: 115 },
]

const DEFAULT_SHARED_EXPENSES = [
  { name: 'Office', amount: 18000 },
  { name: 'Accommodation / flat', amount: 12000 },
  { name: 'Saudis salary and insurance', amount: 12900 },
  { name: 'Electricity and water', amount: 1000 },
]

async function main() {
  // Find all months that have income records
  const allMonths = await db.incomeRecord.findMany({ select: { month: true }, distinct: ['month'] })
  console.log(`Found ${allMonths.length} months with income data`)

  for (const { month } of allMonths) {
    const existingExpenses = await db.expense.findMany({ where: { month } })
    const existingCategories = new Set(existingExpenses.map(e => e.categoryName))
    
    // Find or create the ExpenseCategory records
    const allCategories = await db.expenseCategory.findMany()

    let added = 0

    // Add missing per-driver expenses
    for (const def of DEFAULT_PER_DRIVER_EXPENSES) {
      if (!existingCategories.has(def.name)) {
        let cat = allCategories.find(c => c.name === def.name)
        if (!cat) {
          cat = await db.expenseCategory.create({
            data: {
              name: def.name,
              defaultAmount: def.amount,
              allocationType: 'per_driver',
            },
          })
        }
        await db.expense.create({
          data: {
            month,
            categoryId: cat.id,
            categoryName: cat.name,
            amount: def.amount,
            allocationType: 'per_driver',
            notes: `Auto-seeded default expense`,
            createdBy: 'system-auto-seed',
          },
        })
        added++
        console.log(`  ${month}: Added ${def.name} (${def.amount} SAR, per_driver)`)
      }
    }

    // Add missing shared expenses
    for (const def of DEFAULT_SHARED_EXPENSES) {
      if (!existingCategories.has(def.name)) {
        let cat = allCategories.find(c => c.name === def.name)
        if (!cat) {
          cat = await db.expenseCategory.create({
            data: {
              name: def.name,
              defaultAmount: def.amount,
              allocationType: 'shared',
            },
          })
        }
        await db.expense.create({
          data: {
            month,
            categoryId: cat.id,
            categoryName: cat.name,
            amount: def.amount,
            allocationType: 'shared',
            notes: `Auto-seeded default expense`,
            createdBy: 'system-auto-seed',
          },
        })
        added++
        console.log(`  ${month}: Added ${def.name} (${def.amount} SAR, shared)`)
      }
    }

    if (added === 0) {
      console.log(`  ${month}: All default expenses already present ✅`)
    }
  }

  console.log('\nDone!')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
