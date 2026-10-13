import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

// WR sheet — contract-level aggregation
console.log('=== WR sheet (contract-level) ===')
const wrRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['WR'], { defval: null })
for (const r of wrRows) {
  console.log('Contract:', r['Contract Name'])
  console.log('  completed_orders:', r['الطلبات المكتملة - completed_orders'])
  console.log('  basic_payment:', r['الدفعة الأساسية - basic_payment'])
  console.log('  stacking_deduction:', r['خصم الطلبات المتعددة - stacking_deduction'])
  console.log('  declined_penalties:', r['غرامة الرفض اليومية - declined_penalties_day_logic'])
  console.log('  late_penalty:', r['غرامة التأخير - late_penalty'])
  console.log('  no_show_penalty:', r['غرامة عدم الحضور - no_show_penalty'])
  console.log('  no_show_special:', r['غرامة عدم الحضور للمدن الخاصة - no_show_penalty_special_cities'])
  console.log('  daily_acceptance:', r['غرامة معدل القبول اليومية - daily_acceptance_rate_penalty'])
  console.log('  distance_payment:', r['بدل المسافة - distance_payment'])
  console.log('  missed_days:', r['غرامة الأيام الفائتة - missed_days_penalty'])
  console.log('  segment_payment:', r['بدل الفئات- segment_payment'])
  console.log('  Amount Excl. VAT:', r['المبلغ قبل الضريبة - Amount Excl. VAT'])
  console.log('  rider_basic:', r['الدفع الأساسي للمندوب - rider_basic'])
  console.log('  rider_scoring:', r['تقييم المندوب - rider_scoring'])
  console.log('  Rider Balance:', r['محفظة المندوب - Rider Balance'])
  console.log('  Total Deduction:', r['إجمالي الخصومات - Total Deduction'])
  console.log('  Net FTR:', r['صافي المستحق FTR - Net FTR'])
}

// Check: Net FTR = basic_payment + distance_payment + segment_payment - Total Deduction ?
const wr = wrRows[0]
const basic = Number(wr['الدفعة الأساسية - basic_payment'])
const distance = Number(wr['بدل المسافة - distance_payment'])
const segment = Number(wr['بدل الفئات- segment_payment'])
const totalDed = Number(wr['إجمالي الخصومات - Total Deduction'])
const netFTR = Number(wr['صافي المستحق FTR - Net FTR'])
const riderBalance = Number(wr['محفظة المندوب - Rider Balance'])

console.log('\n=== Verify WR formula ===')
console.log(`basic_payment + distance + segment - totalDed = ${basic + distance + segment - totalDed}`)
console.log(`netFTR = ${netFTR}`)
console.log(`totalDed = ${totalDed}`)
console.log(`riderBalance = ${riderBalance}`)
console.log(`Is totalDed == riderBalance? ${Math.abs(totalDed - riderBalance) < 0.01}`)
