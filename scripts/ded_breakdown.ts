import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { parseWorkbook } from '../src/lib/excel-parser'
import { calculateDriverSalary } from '../src/lib/salary-engine'
import { getDefaultRuleMap } from '../src/lib/rules'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
const parsed = parseWorkbook(ab)

const wb = XLSX.read(buf, { type: 'buffer' })
const salRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Salary_Calculation'], { defval: null })
const rules = getDefaultRuleMap() as any

console.log('=== App penalties breakdown ===')
for (const salRow of salRows.slice(0, 5)) {
  const rid = String(salRow['Rider ID'] ?? '').trim()
  if (!rid) continue
  const ourDriver = parsed.drivers.find(d => d.riderId === rid)
  if (!ourDriver) continue

  const result = calculateDriverSalary(ourDriver, rules, 'Default', 'August 2026')
  console.log(`\nRider ${rid}:`)
  console.log(`  App penalties:`, JSON.stringify(result.penalties, null, 2))
  console.log(`  App totalOtherPenalties: ${result.totalOtherPenalties}`)
  console.log(`  App missingOrderDeduction: ${result.missingOrderDeduction}`)
  console.log(`  App totalDeductions (pen+miss): ${result.totalOtherPenalties + result.missingOrderDeduction}`)
  console.log(`  Excel Total Deductions: ${salRow['Total Deductions']}`)
  console.log(`  Excel riderBalance: ${salRow['Rider Balance']}, stacking: ${salRow['stacking_deduction']}, missedDays: ${salRow['missed_days_penalty']}`)
}
