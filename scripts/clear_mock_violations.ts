import { db } from '../src/lib/db'

async function main() {
  const before = await db.trafficViolation.count()
  console.log(`Traffic violations before: ${before}`)

  if (before > 0) {
    // Only delete ones with notes matching the seed sample pattern
    // OR all of them if user wants a clean slate — let's delete only the seed mocks:
    const deleted = await db.trafficViolation.deleteMany({
      where: { notes: { contains: 'Sample' } }
    })
    console.log(`Deleted ${deleted.count} sample/mock violations`)

    // Also delete any with the specific demo types from the seed
    await db.trafficViolation.deleteMany({
      where: {
        OR: [
          { notes: { contains: 'demo' } },
          { notes: { contains: 'Sample' } },
        ]
      }
    })
  }

  const after = await db.trafficViolation.count()
  console.log(`Traffic violations after: ${after}`)

  const remaining = await db.trafficViolation.findMany({ select: { riderId: true, violationType: true, amount: true, notes: true } })
  if (remaining.length > 0) {
    console.log('Remaining violations:')
    for (const v of remaining) console.log(`  - ${v.riderId}: ${v.violationType} SAR ${v.amount} (${v.notes ?? 'no notes'})`)
  } else {
    console.log('All clean — no traffic violations remain')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
