import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

const salRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Salary_Calculation'], { defval: null })

console.log('=== Excel Total Deductions breakdown per rider ===')
for (const salRow of salRows) {
  const rid = String(salRow['Rider ID'] ?? '').trim()
  if (!rid) continue
  const missedDays = Number(salRow['missed_days_penalty'] ?? 0)
  const riderBalance = Number(salRow['Rider Balance'] ?? 0)
  const stacking = Number(salRow['stacking_deduction'] ?? 0)
  const otherDeductions = Number(salRow['Other Deductions'] ?? 0)
  const totalDeductions = Number(salRow['Total Deductions'] ?? 0)

  // Excel Total Deductions = rider_balance + stacking + missed_days + other_deductions
  const computed = riderBalance + Math.abs(stacking) + Math.abs(missedDays) + otherDeductions

  console.log(`Rider ${rid}: missedDays=${missedDays}, riderBalance=${riderBalance}, stacking=${stacking}, other=${otherDeductions} → total=${totalDeductions} (computed=${computed.toFixed(2)})`)
}
