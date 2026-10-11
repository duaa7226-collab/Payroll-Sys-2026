import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { parseWorkbook } from '../src/lib/excel-parser'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

try {
  const parsed = parseWorkbook(ab)
  console.log('=== Parse succeeded ===')
  console.log('Drivers:', parsed.drivers.length)
  console.log('Warnings:', parsed.warnings.length)
  for (const w of parsed.warnings.slice(0, 5)) console.log('  -', w)
  console.log('Banking source:', parsed.banking.source)
  console.log('Banking:', parsed.banking)

  console.log('\n=== First 3 drivers ===')
  for (const d of parsed.drivers.slice(0, 3)) {
    console.log(`  ${d.name} (${d.riderId}):`)
    console.log(`    completedOrders: ${d.completedOrders}`)
    console.log(`    uploadedBasicPayment: ${d.uploadedBasicPayment}`)
    console.log(`    uploadedCityPayment: ${d.uploadedCityPayment}`)
    console.log(`    actualWorkingDays: ${d.actualWorkingDays}`)
    console.log(`    fullyWorkingDays: ${d.fullyWorkingDays}`)
    console.log(`    workingHours: ${d.workingHours}`)
    console.log(`    riderBalance: ${d.riderBalance}`)
    console.log(`    segmentPayment: ${d.segmentPayment}`)
    console.log(`    penalties:`, d.penalties)
  }

  // Compare with Excel's Salary_Calculation for rider 4611383
  console.log('\n=== Comparison with Excel Salary_Calculation ===')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const salRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Salary_Calculation'], { defval: null })
  const rlvlRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Paste_RLVL'], { defval: null })
  for (const salRow of salRows) {
    const rid = String(salRow['Rider ID'] ?? '').trim()
    if (!rid) continue
    const ourDriver = parsed.drivers.find(d => d.riderId === rid)
    const rlvlRow = rlvlRows.find(r => String(r['معرف المندوب - rider_id'] ?? '').trim() === rid)
    if (!ourDriver || !rlvlRow) continue

    console.log(`\n  Rider ${rid} (${salRow['Rider Name']}):`)
    console.log(`    Excel — Working Days: ${salRow['Working Days']}, Calendar Days: ${salRow['Calendar Days']}`)
    console.log(`    App   — actualWorkingDays: ${ourDriver.actualWorkingDays}`)
    console.log(`    Excel — Completed Orders: ${salRow['Completed Orders']}`)
    console.log(`    App   — completedOrders: ${ourDriver.completedOrders}`)
    console.log(`    Excel — Monthly Target Orders: ${salRow['Monthly Target Orders']}`)
    console.log(`    Excel — Rider Target Orders: ${salRow['Rider Target Orders']}`)
    console.log(`    Excel — Base Order Rate: ${salRow['Base Order Rate']}`)
    console.log(`    Excel — Earned Salary: ${salRow['Earned Salary']}`)
    console.log(`    Excel — Missing Orders: ${salRow['Missing Orders']}`)
    console.log(`    Excel — Missing-Order Deduction: ${salRow['Missing-Order Deduction']}`)
    console.log(`    Excel — Extra Orders: ${salRow['Extra Orders']}`)
    console.log(`    Excel — Extra-Order Bonus: ${salRow['Extra-Order Bonus']}`)
    console.log(`    Excel — Gross Salary Before Deductions: ${salRow['Gross Salary Before Deductions']}`)
    console.log(`    Excel — Total Deductions: ${salRow['Total Deductions']}`)
    console.log(`    Excel — Final Salary: ${salRow['Final Salary']}`)
    console.log(`    Excel — riderBalance: ${salRow['Rider Balance']}`)
    console.log(`    App   — riderBalance: ${ourDriver.riderBalance}`)
    console.log(`    Excel — stacking: ${salRow['stacking_deduction']}`)
    console.log(`    App   — stacking: ${ourDriver.penalties.stacking_deduction}`)
    console.log(`    RLVL  — basic_payment: ${rlvlRow['الدفعة الأساسية - basic_payment']}`)
    console.log(`    App   — uploadedBasicPayment: ${ourDriver.uploadedBasicPayment}`)
  }
} catch (e: any) {
  console.error('Parse failed:', e.message)
}
