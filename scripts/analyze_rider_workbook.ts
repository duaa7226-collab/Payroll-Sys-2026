import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/Rider_Salary_Workbook_2026_logo.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

console.log('=== Sheets ===')
console.log(wb.SheetNames)

for (const sn of wb.SheetNames) {
  console.log(`\n===== Sheet: "${sn}" =====`)
  const sheet = wb.Sheets[sn]
  if (!sheet['!ref']) { console.log('  (empty)'); continue }
  const range = XLSX.utils.decode_range(sheet['!ref'])
  console.log('  Range:', sheet['!ref'], ' rows:', range.e.r - range.s.r, ' cols:', range.e.c - range.s.c)

  const rows = XLSX.utils.sheet_to_json(sheet as any, { defval: null, header: 1 }) as any[][]
  if (rows.length === 0) continue
  const headers = rows[0] as any[]
  console.log('  All headers (raw):')
  headers.forEach((h, i) => {
    console.log(`    [${i}] ${JSON.stringify(h)}`)
  })
  if (sn.toLowerCase().includes('rlvl') || sn.toLowerCase().includes('rider')) {
    console.log('  --- First 3 data rows ---')
    for (let i = 1; i < Math.min(4, rows.length); i++) {
      const r = rows[i]
      console.log(`  Row ${i}:`)
      headers.forEach((h, j) => {
        const v = r[j]
        if (v !== null && v !== undefined && v !== '') {
          console.log(`    ${JSON.stringify(h)} = ${JSON.stringify(v)}`)
        }
      })
    }
  }
}
