import * as XLSX from 'xlsx'
import * as fs from 'fs'

const buf = fs.readFileSync('/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx')
const wb = XLSX.read(buf, { type: 'buffer' })
console.log('Sheets:', wb.SheetNames)
for (const sn of wb.SheetNames) {
  console.log('\n=== Sheet:', sn, '===')
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn] as any, { defval: null })
  if (rows.length === 0) { console.log('  (empty)'); continue; }
  console.log('  Row count:', rows.length)
  const headers = Object.keys(rows[0] as Record<string, any>)
  console.log('  Headers:', headers)
  if (sn.toLowerCase().includes('rlvl')) {
    console.log('  --- Looking for banking-like fields in RLVL rows ---')
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const r = rows[i] as Record<string, any>
      const bankLike: Record<string, any> = {}
      for (const k of Object.keys(r)) {
        const v = r[k]
        const ks = String(k).toLowerCase()
        if (ks.includes('bank') || ks.includes('iban') || ks.includes('benef') || ks.includes('name') || ks.includes('account') || ks.includes('رمز') || ks.includes('ابان') || ks.includes('مستف') || ks.includes('البنك')) {
          bankLike[k] = v
        }
      }
      console.log('  Row', i, ':', JSON.stringify(bankLike))
    }
  }
}
