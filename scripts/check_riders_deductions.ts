import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  console.log('Payroll run:', run.payrollMonth)

  const results = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    select: { riderId: true, driverName: true, penaltiesJson: true, finalNetSalary: true, totalOtherPenalties: true, missingOrderDeduction: true },
    orderBy: { riderId: 'asc' },
  })

  // Check specific riders
  const targetRiders = ['4898620', '4648709']
  for (const rid of targetRiders) {
    const r = results.find(d => d.riderId === rid)
    if (r) {
      const p = JSON.parse(r.penaltiesJson || '{}')
      console.log(`\n=== Rider ${rid} (${r.driverName}) ===`)
      console.log(`  missed_days: ${p.missed_days ?? 0}`)
      console.log(`  declined: ${p.declined ?? 0}`)
      console.log(`  stacking: ${p.stacking ?? 0}`)
      console.log(`  rider_balance: ${p.rider_balance ?? 0}`)
      console.log(`  totalOtherPenalties (deductible): ${r.totalOtherPenalties}`)
      console.log(`  missingOrderDeduction: ${r.missingOrderDeduction}`)
      console.log(`  finalNetSalary: ${r.finalNetSalary}`)
      console.log(`  ALL penalties:`, JSON.stringify(p, null, 2))
    } else {
      console.log(`\nRider ${rid} NOT FOUND in this run`)
      console.log('Available riders:', results.map(r => r.riderId).join(', '))
    }
  }

  // Also check income records
  console.log('\n=== Income Records ===')
  const monthKey = '2026-10'
  const incomeRecs = await db.incomeRecord.findMany({
    where: { month: monthKey },
    select: { riderId: true, missedDaysPenalty: true, declinedPenalty: true, stackingDeduction: true, riderBalance: true, totalPenalties: true, totalIncome: true },
  })
  for (const rid of targetRiders) {
    const ir = incomeRecs.find(r => r.riderId === rid)
    if (ir) {
      console.log(`Rider ${rid}: missedDays=${ir.missedDaysPenalty}, declined=${ir.declinedPenalty}, stacking=${ir.stackingDeduction}, riderBalance=${ir.riderBalance}, totalPen=${ir.totalPenalties}, totalIncome=${ir.totalIncome}`)
    } else {
      console.log(`Rider ${rid}: NOT in income records`)
    }
  }

  // Check expenses
  console.log('\n=== Expenses for 2026-10 ===')
  const expenses = await db.expense.findMany({ where: { month: monthKey } })
  for (const e of expenses) {
    console.log(`  ${e.categoryName}: ${e.amount} (${e.allocationType})`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
