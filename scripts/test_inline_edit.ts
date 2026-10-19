// Test inline edit for rider 4652587 — change working days from current to 30
import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }

  const r = await db.driverResult.findFirst({
    where: { payrollRunId: run.id, riderId: '4652587' },
  })
  if (!r) { console.log('Rider 4652587 not found'); return }

  console.log('=== BEFORE ===')
  console.log(`  Working Days: ${r.actualWorkingDays}`)
  console.log(`  Target: ${r.selectedTargetThreshold}`)
  console.log(`  Gross: ${r.grossSalaryBeforePenalties}`)
  console.log(`  Net: ${r.finalNetSalary}`)

  // Call PATCH API
  const resp = await fetch('http://localhost:3000/api/drivers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: r.id, field: 'actualWorkingDays', value: 30 }),
  })
  const data = await resp.json()

  if (data.success) {
    console.log('\n=== AFTER (Working Days = 30) ===')
    console.log(`  Old working days: ${data.oldValue}`)
    console.log(`  New working days: ${data.newValue}`)
    console.log(`  New target: ${data.result.selectedTargetThreshold}`)
    console.log(`  New gross: ${data.result.grossSalaryBeforePenalties}`)
    console.log(`  New net: ${data.result.finalNetSalary}`)
    console.log('\n✅ INSTANT RECALCULATION WORKS!')

    // Revert back to original
    console.log('\n=== Reverting to original... ===')
    const revert = await fetch('http://localhost:3000/api/drivers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, field: 'actualWorkingDays', value: r.actualWorkingDays }),
    })
    const revertData = await revert.json()
    if (revertData.success) {
      console.log(`  Reverted to ${revertData.newValue} working days ✅`)
    }
  } else {
    console.log('❌ Failed:', data.error)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
