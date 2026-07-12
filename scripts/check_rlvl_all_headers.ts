import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

// Print ALL headers from ALL sheets, also check raw cells for hidden columns
for (const sn of wb.SheetNames) {
  console.log(`\n===== Sheet: "${sn}" =====`)
  const sheet = wb.Sheets[sn]
  if (!sheet['!ref']) { console.log('  (empty sheet)'); continue }
  const range = XLSX.utils.decode_range(sheet['!ref'])
  console.log('  Range:', sheet['!ref'], ' rows:', range.e.r - range.s.r, ' cols:', range.e.c - range.s.c)
  
  const rows = XLSX.utils.sheet_to_json(sheet as any, { defval: null, header: 1 }) as any[][]
  if (rows.length === 0) continue
  const headers = rows[0] as any[]
  console.log('  All headers (raw):')
  headers.forEach((h, i) => {
    console.log(`    [${i}] ${JSON.stringify(h)}`)
  })
}
