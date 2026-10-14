import { db } from '../src/lib/db'
import { calculateIncome } from '../src/lib/income-expenses-engine'

async function main() {
  // Check IncomeRecord for rider 4648308
  const records = await db.incomeRecord.findMany({
    where: { riderId: '4648308' },
  })
  
  if (records.length === 0) {
    console.log('No IncomeRecord found for rider 4648308 — need to sync from payroll')
    return
  }
  
  for (const rec of records) {
    console.log(`\n=== IncomeRecord for rider 4648308 (${rec.companyName}, ${rec.month}) ===`)
    console.log('  basicPayment:', rec.basicPayment)
    console.log('  distancePayment:', rec.distancePayment)
    console.log('  segmentPayment:', rec.segmentPayment)
    console.log('  stackingDeduction:', rec.stackingDeduction)
    console.log('  riderBalance:', rec.riderBalance)
    console.log('  totalIncome (cached):', rec.totalIncome)
    console.log('  totalPenalties (cached):', rec.totalPenalties)
    
    // Recalculate
    const calc = calculateIncome(rec)
    console.log('\n  --- RECALCULATED ---')
    console.log('  totalPenalties (new):', calc.totalPenalties)
    console.log('  totalIncome (new):', calc.totalIncome)
    console.log('  Expected: basic(4576) + distance(3885.19) + segment(1001) - penalties(536.77) = 8925.42')
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
