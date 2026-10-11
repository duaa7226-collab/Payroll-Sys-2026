import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

// Replicate the findCol logic from excel-parser.ts
function norm(s: string): string {
  if (!s) return ''
  return String(s)
    .split(' - ')[0]
    .replace(/Sum of /i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function findCol(headers: string[], ...candidates: string[]): string | null {
  const normalized = headers.map(h => ({ raw: h, norm: norm(h) }))
  for (const cand of candidates) {
    const c = cand.toLowerCase().replace(/\s+/g, '_')
    const found = normalized.find(h => h.norm === c)
    if (found) return found.raw
  }
  for (const cand of candidates) {
    const c = cand.toLowerCase().replace(/\s+/g, '_')
    const found = normalized.find(h => h.norm.startsWith(c))
    if (found) return found.raw
  }
  for (const cand of candidates) {
    const c = cand.toLowerCase()
    const found = normalized.find(h => h.raw.toLowerCase().includes(c))
    if (found) return found.raw
  }
  return null
}

// Test on Paste_RLVL
const rlvlRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Paste_RLVL'], { defval: null })
const rlvlHeaders = Object.keys(rlvlRows[0])
console.log('=== Paste_RLVL Headers ===')
rlvlHeaders.forEach(h => console.log(`  raw: "${h}" → norm: "${norm(h)}"`))

console.log('\n=== findCol results ===')
const tests: [string, string[]][] = [
  ['rider_id', ['rider_id', 'riderid']],
  ['name', ['name']],
  ['contract_name', ['contract_name', 'contract name']],
  ['completed_orders', ['completed_orders']],
  ['city_payment', ['city_payment']],
  ['basic_payment', ['basic_payment']],
  ['acceptance_rate_penalties', ['acceptance_rate_penalties']],
  ['contact_rate_penalties', ['contact_rate_penalties']],
  ['stacking_deduction', ['stacking_deduction']],
  ['declined_penalties_day_logic', ['declined_penalties_day_logic', 'declined_penalties']],
  ['late_penalty', ['late_penalty']],
  ['no_show_penalty', ['no_show_penalty']],
  ['no_show_penalty_special_cities', ['no_show_penalty_special_cities']],
  ['daily_acceptance_rate_penalty', ['daily_acceptance_rate_penalty']],
  ['distance_payment', ['distance_payment']],
  ['missed_days_penalty', ['missed_days_penalty']],
  ['segment_payment', ['segment_payment']],
  ['rider_balance', ['rider_balance']],
  ['beneficiary_name', ['beneficiary_name', 'beneficiary']],
  ['iban', ['iban']],
  ['bank_name', ['bank_name', 'bank']],
]
for (const [label, candidates] of tests) {
  const found = findCol(rlvlHeaders, ...candidates)
  console.log(`  ${label}: ${found ? `✓ "${found}"` : '✗ NOT FOUND'}`)
}

// Test on Paste_FTR
console.log('\n=== Paste_FTR Headers ===')
const ftrRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Paste_FTR'], { defval: null })
const ftrHeaders = Object.keys(ftrRows[0])
ftrHeaders.forEach(h => console.log(`  raw: "${h}" → norm: "${norm(h)}"`))

console.log('\n=== FTR findCol results ===')
const ftrTests: [string, string[]][] = [
  ['rider_id', ['rider_id', 'riderid']],
  ['name', ['name']],
  ['contract_name', ['contract_name', 'contract name']],
  ['rider_vehicle_type', ['rider_vehicle_type', 'vehicle_type']],
  ['total_monthly_working_hours', ['total_monthly_working_hours']],
  ['working_hours', ['working_hours']],
  ['fully_working_days', ['fully_working_days']],
  ['working_days', ['working_days']],
  ['inactive_reason', ['inactive_reason']],
]
for (const [label, candidates] of ftrTests) {
  const found = findCol(ftrHeaders, ...candidates)
  console.log(`  ${label}: ${found ? `✓ "${found}"` : '✗ NOT FOUND'}`)
}
