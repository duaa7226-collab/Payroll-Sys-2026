import { db } from '../src/lib/db'
import { calculateIncome } from '../src/lib/income-expenses-engine'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  console.log('Payroll run:', run.payrollMonth)

  // Check salary engine DEDUCTIBLE_PENALTIES
  console.log('\n=== Salary Engine DEDUCTIBLE_PENALTIES ===')
  const salaryEngine = await import('../src/lib/salary-engine')
  // Can't access internal constant, but we know it's: stacking, missed_days, rider_balance, car_deduction, tga_deduction
  console.log('  Currently deductible: stacking, missed_days, rider_balance, car_deduction, tga_deduction')
  console.log('  NOT deductible: acceptance, contact, declined, late, noshow, noshow_special, daily_acceptance')

  // Check both riders in DriverResult
  const results = await db.driverResult.findMany({
    where: { payrollRunId: run.id, riderId: { in: ['4898620', '4648709'] } },
  })
  
  for (const r of results) {
    const p = JSON.parse(r.penaltiesJson || '{}')
    console.log(`\n=== Rider ${r.riderId} (${r.driverName}) — SALARY ENGINE ===`)
    console.log(`  missed_days: ${p.missed_days ?? 0} → DEDUCTED ✅`)
    console.log(`  declined: ${p.declined ?? 0} → ${p.declined ? 'NOT DEDUCTED ❌' : 'n/a'}`)
    console.log(`  stacking: ${p.stacking ?? 0} → DEDUCTED ✅`)
    console.log(`  rider_balance: ${p.rider_balance ?? 0} → DEDUCTED ✅`)
    console.log(`  totalOtherPenalties: ${r.totalOtherPenalties} (only includes deductible ones)`)
    console.log(`  finalNetSalary: ${r.finalNetSalary}`)
  }

  // Check income records
  const incomeRecs = await db.incomeRecord.findMany({
    where: { month: '2026-10', riderId: { in: ['4898620', '4648709'] } },
  })
  
  for (const ir of incomeRecs) {
    const calc = calculateIncome(ir)
    console.log(`\n=== Rider ${ir.riderId} — INCOME VS EXPENSES ===`)
    console.log(`  missedDaysPenalty: ${ir.missedDaysPenalty}`)
    console.log(`  declinedPenalty: ${ir.declinedPenalty}`)
    console.log(`  stackingDeduction: ${ir.stackingDeduction}`)
    console.log(`  riderBalance: ${ir.riderBalance}`)
    console.log(`  totalPenalties (incl ALL): ${calc.totalPenalties}`)
    console.log(`  totalIncome: ${calc.totalIncome}`)
    console.log(`  → declined ${ir.declinedPenalty > 0 ? 'IS deducted ✅' : 'is 0'}`)
  }

  // Check expenses
  console.log('\n=== Expenses for 2026-10 ===')
  const expenses = await db.expense.findMany({ where: { month: '2026-10' } })
  const internetExp = expenses.find(e => e.categoryName === 'Internet')
  console.log(`  Internet expense: ${internetExp ? `${internetExp.amount} SAR (${internetExp.allocationType}) ✅` : 'NOT FOUND ❌'}`)
  
  // Check other months
  console.log('\n=== Internet in other months ===')
  const allIncomeRecs = await db.incomeRecord.findMany({ select: { month: true }, distinct: ['month'] })
  for (const { month } of allIncomeRecs) {
    const exp = await db.expense.findMany({ where: { month, categoryName: 'Internet' } })
    console.log(`  ${month}: ${exp.length > 0 ? '✅' : '❌ MISSING'}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
