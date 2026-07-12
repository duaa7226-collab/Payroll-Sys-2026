import * as fs from 'fs'
import { db } from '../src/lib/db'
import { parseWorkbook } from '../src/lib/excel-parser'

async function main() {
  const buf = fs.readFileSync('/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
  const parsed = parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)

  console.log('Banking source:', parsed.banking.source)
  console.log('Aggregate banking:', parsed.banking)

  // Update every driver with the correct banking info
  const drivers = await db.driver.findMany()
  let updated = 0
  for (const d of drivers) {
    const perDriver = parsed.driverBanking[d.riderId]
    const beneficiaryName = perDriver?.beneficiaryName || parsed.banking.beneficiaryName || null
    const iban = perDriver?.iban || parsed.banking.iban || null
    const bankName = perDriver?.bankName || parsed.banking.bankName || null

    if (d.beneficiaryName !== beneficiaryName || d.iban !== iban || d.bankName !== bankName) {
      await db.driver.update({
        where: { id: d.id },
        data: { beneficiaryName, iban, bankName },
      })
      updated++
      console.log(`Updated ${d.name} (${d.riderId}): beneficiary=${beneficiaryName}, iban=${iban}, bank=${bankName}`)
    }
  }
  console.log(`\nTotal updated: ${updated} / ${drivers.length}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
