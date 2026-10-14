import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  console.log('Payroll run:', run.payrollMonth, '(', run.fileName, ')')
  
  const results = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    select: { riderId: true, driverName: true, uploadedBasicPayment: true, segmentPayment: true, penaltiesJson: true, finalNetSalary: true, completedOrders: true },
  })
  
  // Find rider 4648308
  const rider = results.find(r => r.riderId === '4648308')
  if (rider) {
    console.log('\n=== Rider 4648308 ===')
    console.log('Name:', rider.driverName)
    console.log('Completed Orders:', rider.completedOrders)
    console.log('Uploaded Basic Payment:', rider.uploadedBasicPayment)
    console.log('Segment Payment field:', rider.segmentPayment)
    console.log('Final Net Salary:', rider.finalNetSalary)
    const p = JSON.parse(rider.penaltiesJson || '{}')
    console.log('Penalties JSON keys:', Object.keys(p))
    console.log('  stacking:', p.stacking)
    console.log('  rider_balance:', p.rider_balance)
    console.log('  distance:', p.distance ?? 'MISSING')
    console.log('  segment:', p.segment ?? 'MISSING')
    console.log('  missed_days:', p.missed_days)
    console.log('  All values:', JSON.stringify(p, null, 2))
  } else {
    console.log('Rider 4648308 NOT FOUND in this payroll run')
    console.log('Available riders:', results.map(r => r.riderId).join(', '))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
