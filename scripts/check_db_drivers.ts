import { db } from '../src/lib/db'

async function main() {
  const drivers = await db.driver.findMany({ select: { riderId: true, name: true, beneficiaryName: true, iban: true, bankName: true } })
  console.log('Drivers in DB:')
  for (const d of drivers) {
    console.log(`  ${d.name} (${d.riderId}):`)
    console.log(`    beneficiary: ${d.beneficiaryName ?? '(null)'}`)
    console.log(`    iban: ${d.iban ?? '(null)'}`)
    console.log(`    bank: ${d.bankName ?? '(null)'}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
