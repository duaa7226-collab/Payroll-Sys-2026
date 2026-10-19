import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) return
  const r = await db.driverResult.findFirst({
    where: { payrollRunId: run.id, riderId: '4648709' },
  })
  if (r) {
    const p = JSON.parse(r.penaltiesJson || '{}')
    console.log('=== Rider 4648709 AFTER recalc ===')
    console.log(`  declined: ${p.declined} (should be 50)`)
    console.log(`  stacking: ${p.stacking}`)
    console.log(`  rider_balance: ${p.rider_balance}`)
    console.log(`  totalOtherPenalties: ${r.totalOtherPenalties}`)
    console.log(`  Was 584.2 (without declined), now: ${r.totalOtherPenalties} (with declined=50)`)
    console.log(`  Expected: 584.2 + 50 = 634.2`)
    console.log(`  finalNetSalary: ${r.finalNetSalary}`)
    console.log(`  Was 1755.8, now: ${r.finalNetSalary} (should be 1755.8 - 50 = 1705.8)`)
  }

  // Also check rider 4898620
  const r2 = await db.driverResult.findFirst({
    where: { payrollRunId: run.id, riderId: '4898620' },
  })
  if (r2) {
    const p = JSON.parse(r2.penaltiesJson || '{}')
    console.log('\n=== Rider 4898620 AFTER recalc ===')
    console.log(`  missed_days: ${p.missed_days} (should be 500)`)
    console.log(`  totalOtherPenalties: ${r2.totalOtherPenalties}`)
    console.log(`  finalNetSalary: ${r2.finalNetSalary}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
