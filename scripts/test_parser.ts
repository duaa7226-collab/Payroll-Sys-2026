import * as fs from 'fs'
import { parseWorkbook } from '../src/lib/excel-parser'

const buf = fs.readFileSync('/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
const parsed = parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)

console.log('=== Banking source:', parsed.banking.source, '===')
console.log('Beneficiary:', parsed.banking.beneficiaryName)
console.log('IBAN:', parsed.banking.iban)
console.log('Bank:', parsed.banking.bankName)
console.log('\n=== Per-driver banking (from RLVL) ===')
console.log('Drivers with banking:', Object.keys(parsed.driverBanking).length)
for (const [riderId, b] of Object.entries(parsed.driverBanking)) {
  console.log(`  ${riderId}:`, b)
}
console.log('\n=== Stacking deduction sample (first 3 drivers) ===')
for (const d of parsed.drivers.slice(0, 3)) {
  console.log(`  ${d.name} (${d.riderId}): stacking_deduction = ${d.penalties.stacking_deduction}`)
}
