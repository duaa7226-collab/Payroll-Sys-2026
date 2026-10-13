// Test that the app's salary calculation matches the Excel Salary_Calculation sheet exactly
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { parseWorkbook } from '../src/lib/excel-parser'
import { calculateDriverSalary } from '../src/lib/salary-engine'
import { getDefaultRuleMap } from '../src/lib/rules'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

const parsed = parseWorkbook(ab)
console.log(`Parsed ${parsed.drivers.length} drivers\n`)

// Get Excel's Salary_Calculation sheet for comparison
const wb = XLSX.read(buf, { type: 'buffer' })
const salRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Salary_Calculation'], { defval: null })

const rules = getDefaultRuleMap() as any
const ruleSetName = 'Default 2026 Rule Set'
const payrollMonth = 'August 2026'

let totalDiff = 0
let maxDiff = 0
let matchCount = 0
let totalCompared = 0

console.log('=== Per-rider comparison: App vs Excel ===')
console.log('Rider | Working Days | Completed | Excel Gross | App Gross | Excel Final | App Final | Diff')
console.log('-'.repeat(100))

for (const salRow of salRows) {
  const rid = String(salRow['Rider ID'] ?? '').trim()
  if (!rid) continue

  const ourDriver = parsed.drivers.find(d => d.riderId === rid)
  if (!ourDriver) {
    console.log(`Rider ${rid}: NOT FOUND in parsed data`)
    continue
  }

  totalCompared++

  const result = calculateDriverSalary(ourDriver, rules, ruleSetName, payrollMonth)

  const excelGross = Number(salRow['Gross Salary Before Deductions'] ?? 0)
  const excelFinal = Number(salRow['Final Salary'] ?? 0)
  const excelTotalDeductions = Number(salRow['Total Deductions'] ?? 0)
  const excelMissingDeduction = Number(salRow['Missing-Order Deduction'] ?? 0)

  const appGross = result.grossSalaryBeforePenalties
  const appFinal = result.finalNetSalary
  // App's totalOtherPenalties = rider_balance + stacking + missed_days + car + tga (matches Excel's "Total Deductions")
  const appTotalDeductions = result.totalOtherPenalties + result.trafficViolationsDeduction
  // App's missingOrderDeduction (applied separately to gross)
  const appMissingDeduction = result.missingOrderDeduction

  const grossDiff = Math.abs(appGross - excelGross)
  const finalDiff = Math.abs(appFinal - excelFinal)
  const dedDiff = Math.abs(appTotalDeductions - excelTotalDeductions)
  const missingDiff = Math.abs(appMissingDeduction - excelMissingDeduction)

  const maxRowDiff = Math.max(grossDiff, finalDiff, dedDiff, missingDiff)
  totalDiff += maxRowDiff
  if (maxRowDiff > maxDiff) maxDiff = maxRowDiff
  if (maxRowDiff < 0.01) matchCount++

  console.log(
    `${rid} | ${ourDriver.actualWorkingDays} | ${ourDriver.completedOrders} | ` +
    `${excelGross.toFixed(2)} | ${appGross.toFixed(2)} | ` +
    `${excelFinal.toFixed(2)} | ${appFinal.toFixed(2)} | ` +
    `grossDiff=${grossDiff.toFixed(2)} finalDiff=${finalDiff.toFixed(2)} dedDiff=${dedDiff.toFixed(2)} missingDiff=${missingDiff.toFixed(2)}`
  )
}

console.log('\n=== Summary ===')
console.log(`Total riders compared: ${totalCompared}`)
console.log(`Exact matches (< 0.01 SAR diff): ${matchCount}`)
console.log(`Max diff: ${maxDiff.toFixed(4)} SAR`)
console.log(`Total diff: ${totalDiff.toFixed(4)} SAR`)
