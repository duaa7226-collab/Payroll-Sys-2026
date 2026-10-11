import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

// Look at Salary_Calculation sheet
console.log('\n===== Salary_Calculation sheet =====')
const salSheet = wb.Sheets['Salary_Calculation']
if (salSheet) {
  const rows = XLSX.utils.sheet_to_json(salSheet as any, { defval: null, header: 1 }) as any[][]
  if (rows.length > 0) {
    console.log('  Headers:')
    ;(rows[0] as any[]).forEach((h, i) => {
      console.log(`    [${i}] ${JSON.stringify(h)}`)
    })
    console.log('  --- First 3 data rows ---')
    for (let i = 1; i < Math.min(4, rows.length); i++) {
      const r = rows[i]
      console.log(`  Row ${i}:`)
      ;(rows[0] as any[]).forEach((h, j) => {
        const v = r?.[j]
        if (v !== null && v !== undefined && v !== '') {
          console.log(`    ${JSON.stringify(h)} = ${JSON.stringify(v)}`)
        }
      })
    }
  }
}

// Look at Payslip_Data sheet
console.log('\n===== Payslip_Data sheet =====')
const psSheet = wb.Sheets['Payslip_Data']
if (psSheet) {
  const rows = XLSX.utils.sheet_to_json(psSheet as any, { defval: null, header: 1 }) as any[][]
  if (rows.length > 0) {
    console.log('  Headers:')
    ;(rows[0] as any[]).forEach((h, i) => {
      console.log(`    [${i}] ${JSON.stringify(h)}`)
    })
    console.log('  --- First 3 data rows ---')
    for (let i = 1; i < Math.min(4, rows.length); i++) {
      const r = rows[i]
      console.log(`  Row ${i}:`)
      ;(rows[0] as any[]).forEach((h, j) => {
        const v = r?.[j]
        if (v !== null && v !== undefined && v !== '') {
          console.log(`    ${JSON.stringify(h)} = ${JSON.stringify(v)}`)
        }
      })
    }
  }
}

// Look at Settings sheet
console.log('\n===== Settings sheet =====')
const setSheet = wb.Sheets['Settings']
if (setSheet) {
  const rows = XLSX.utils.sheet_to_json(setSheet as any, { defval: null, header: 1 }) as any[][]
  for (const r of rows) {
    if (r.some(c => c !== null && c !== undefined && c !== '')) {
      console.log('  Row:', r.filter(c => c !== null && c !== undefined).join(' | '))
    }
  }
}

// Look at WR sheet
console.log('\n===== WR sheet =====')
const wrSheet = wb.Sheets['WR']
if (wrSheet) {
  const rows = XLSX.utils.sheet_to_json(wrSheet as any, { defval: null, header: 1 }) as any[][]
  if (rows.length > 0) {
    console.log('  Headers:')
    ;(rows[0] as any[]).forEach((h, i) => {
      console.log(`    [${i}] ${JSON.stringify(h)}`)
    })
    console.log('  --- First 2 data rows ---')
    for (let i = 1; i < Math.min(3, rows.length); i++) {
      const r = rows[i]
      console.log(`  Row ${i}:`)
      ;(rows[0] as any[]).forEach((h, j) => {
        const v = r?.[j]
        if (v !== null && v !== undefined && v !== '') {
          console.log(`    ${JSON.stringify(h)} = ${JSON.stringify(v)}`)
        }
      })
    }
  }
}

// Look at Paste_RLVL — full data
console.log('\n===== Paste_RLVL full data =====')
const rlvlSheet = wb.Sheets['Paste_RLVL']
if (rlvlSheet) {
  const rows = XLSX.utils.sheet_to_json(rlvlSheet as any, { defval: null }) as any[]
  console.log('  Total rows:', rows.length)
  for (const r of rows) {
    const rid = r['معرف المندوب - rider_id']
    if (!rid) continue
    const completed = r['الطلبات المكتملة - completed_orders']
    const basic = r['الدفعة الأساسية - basic_payment']
    const stacking = r['خصم الطلبات المتعددة - stacking_deduction']
    const distance = r['بدل المسافة - distance_payment']
    const segment = r['بدل الفئات - segment_payment']
    const riderBalance = r['محفظة المندوب - Rider Balance']
    console.log(`  Rider ${rid}: completed=${completed}, basic=${basic}, stacking=${stacking}, distance=${distance}, segment=${segment}, riderBalance=${riderBalance}`)
  }
}

// Look at Paste_FTR — full data
console.log('\n===== Paste_FTR full data =====')
const ftrSheet = wb.Sheets['Paste_FTR']
if (ftrSheet) {
  const rows = XLSX.utils.sheet_to_json(ftrSheet as any, { defval: null }) as any[]
  console.log('  Total rows:', rows.length)
  for (const r of rows) {
    const rid = r['rider_id']
    if (!rid) continue
    const workingDays = r['working_days']
    const fullyWorkingDays = r['fully_working_days']
    const workingHours = r['working_hours']
    const vehicleType = r['rider_vehicle_type']
    const missedDays = r['missed_days_penalty']
    console.log(`  Rider ${rid}: workingDays=${workingDays}, fullyWorkingDays=${fullyWorkingDays}, workingHours=${workingHours}, vehicle=${vehicleType}, missedDaysPenalty=${missedDays}`)
  }
}
