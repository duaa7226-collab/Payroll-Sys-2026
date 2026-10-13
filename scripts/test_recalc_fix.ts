import { db } from '../src/lib/db'

async function main() {
  // Find the latest payroll run
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run found — please import an Excel file first'); return }
  console.log('Payroll run:', run.id, '(', run.payrollMonth, ')')

  // Check stored penalties BEFORE recalc
  const resultsBefore = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    select: { riderId: true, driverName: true, penaltiesJson: true, totalOtherPenalties: true, finalNetSalary: true },
  })
  console.log(`\n=== BEFORE recalc (${resultsBefore.length} riders) ===`)
  for (const r of resultsBefore.slice(0, 5)) {
    const p = JSON.parse(r.penaltiesJson || '{}')
    console.log(`  ${r.driverName} (${r.riderId}):`)
    console.log(`    penaltiesJson: stacking=${p.stacking}, missed_days=${p.missed_days}, rider_balance=${p.rider_balance}`)
    console.log(`    totalOtherPenalties: ${r.totalOtherPenalties}`)
    console.log(`    finalNetSalary: ${r.finalNetSalary}`)
  }

  // Trigger recalc via API
  console.log('\n=== Triggering recalc... ===')
  const resp = await fetch(`http://localhost:3000/api/recalculate?runId=${run.id}`, { method: 'POST' })
  console.log('Status:', resp.status)
  const text = await resp.text()
  console.log('Response:', text.slice(0, 300))

  // Check AFTER recalc
  const resultsAfter = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    select: { riderId: true, driverName: true, penaltiesJson: true, totalOtherPenalties: true, finalNetSalary: true },
  })
  console.log(`\n=== AFTER recalc (${resultsAfter.length} riders) ===`)
  for (const r of resultsAfter.slice(0, 5)) {
    const p = JSON.parse(r.penaltiesJson || '{}')
    console.log(`  ${r.driverName} (${r.riderId}):`)
    console.log(`    penaltiesJson: stacking=${p.stacking}, missed_days=${p.missed_days}, rider_balance=${p.rider_balance}`)
    console.log(`    totalOtherPenalties: ${r.totalOtherPenalties}`)
    console.log(`    finalNetSalary: ${r.finalNetSalary}`)
  }

  // Compare
  console.log('\n=== Comparison ===')
  let stackingLost = 0
  for (let i = 0; i < resultsBefore.length; i++) {
    const before = resultsBefore[i]
    const after = resultsAfter.find(r => r.riderId === before.riderId)
    if (!after) continue
    const beforeStacking = JSON.parse(before.penaltiesJson || '{}').stacking ?? 0
    const afterStacking = JSON.parse(after.penaltiesJson || '{}').stacking ?? 0
    if (beforeStacking > 0 && afterStacking === 0) {
      stackingLost++
      console.log(`  ❌ ${before.driverName}: stacking ${beforeStacking} → ${afterStacking} (LOST!)`)
    } else if (beforeStacking > 0 && afterStacking > 0 && beforeStacking === afterStacking) {
      console.log(`  ✅ ${before.driverName}: stacking ${beforeStacking} → ${afterStacking} (preserved)`)
    }
  }
  console.log(`\nTotal stacking lost: ${stackingLost}`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
