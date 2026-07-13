import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })

// Check WR banking fields
const wrRows = XLSX.utils.sheet_to_json(wb.Sheets['WR'] as any, { defval: null })
console.log('WR rows:', wrRows.length)
const wr = wrRows[0] as Record<string, any>
for (const k of Object.keys(wr)) {
  const ks = String(k).toLowerCase()
  if (ks.includes('bank') || ks.includes('iban') || ks.includes('benef')) {
    console.log('  ', k, '=', wr[k])
  }
}
