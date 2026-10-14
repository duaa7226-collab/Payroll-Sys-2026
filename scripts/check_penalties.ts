import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  const results = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    select: { riderId: true, driverName: true, uploadedBasicPayment: true, segmentPayment: true, penaltiesJson: true },
  })
  for (const r of results.slice(0, 5)) {
    const p = JSON.parse(r.penaltiesJson || '{}')
    console.log(`Rider ${r.riderId}: basic=${r.uploadedBasicPayment}, segmentField=${r.segmentPayment}, penalties keys: ${Object.keys(p).join(', ')}`)
    console.log(`  stacking=${p.stacking}, rider_balance=${p.rider_balance}, distance=${p.distance ?? 'MISSING'}, segment=${p.segment ?? 'MISSING'}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
