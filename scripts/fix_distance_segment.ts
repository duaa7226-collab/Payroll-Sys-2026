// Fix: Add distance + segment to existing DriverResult penaltiesJson records
// by re-reading the RLVL sheet from the uploaded Excel and updating the stored penaltiesJson
import { db } from '../src/lib/db'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

async function main() {
  // Get the latest payroll run
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run found'); return }
  console.log('Latest payroll run:', run.payrollMonth, '(', run.fileName, ')')

  // Get all driver results for this run
  const results = await db.driverResult.findMany({ where: { payrollRunId: run.id } })
  console.log(`Found ${results.length} driver results`)

  // Try to read the Excel file to get distance + segment values
  // The fileName tells us which file was imported
  const possiblePaths = [
    `/home/z/my-project/upload/${run.fileName}`,
    `/home/z/my-project/upload/nokhaba_tatweer_ftr_Invoice Issue Sep 2026.xlsx`,
  ]

  let wb: XLSX.WorkBook | null = null
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p)
        wb = XLSX.read(buf, { type: 'buffer' })
        console.log('Read Excel from:', p)
        break
      }
    } catch (e) {}
  }

  if (!wb) {
    console.log('Could not find the Excel file. Will update with distance=0, segment=0.')
    return
  }

  // Find the RLVL sheet
  const rlvlSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('rlvl'))
  if (!rlvlSheetName) {
    console.log('No RLVL sheet found in Excel')
    return
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[rlvlSheetName], { defval: null })
  console.log(`RLVL sheet has ${rows.length} rows`)

  // Find distance_payment and segment_payment columns
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  function findCol(cands: string[]): string | null {
    for (const c of cands) {
      const found = headers.find(h => h.toLowerCase().includes(c.toLowerCase()))
      if (found) return found
    }
    return null
  }

  const riderIdCol = findCol(['rider_id', 'riderid', 'معرف المندوب'])
  const distanceCol = findCol(['distance_payment', 'المسافة'])
  const segmentCol = findCol(['segment_payment', 'الفئات'])

  console.log('riderIdCol:', riderIdCol)
  console.log('distanceCol:', distanceCol)
  console.log('segmentCol:', segmentCol)

  // Build lookup by riderId
  const excelByRider = new Map<string, { distance: number; segment: number }>()
  for (const row of rows) {
    const rid = String(row[riderIdCol!] ?? '').trim()
    if (!rid) continue
    const distance = distanceCol ? Math.abs(parseFloat(String(row[distanceCol] ?? 0)) || 0) : 0
    const segment = segmentCol ? Math.abs(parseFloat(String(row[segmentCol] ?? 0)) || 0) : 0
    excelByRider.set(rid, { distance, segment })
  }

  // Update each DriverResult's penaltiesJson to include distance + segment
  let updated = 0
  for (const dr of results) {
    const penalties = JSON.parse(dr.penaltiesJson || '{}')
    const excelData = excelByRider.get(dr.riderId)
    if (excelData) {
      penalties.distance = excelData.distance
      penalties.segment = excelData.segment
    } else {
      penalties.distance = penalties.distance || 0
      penalties.segment = penalties.segment || 0
    }

    await db.driverResult.update({
      where: { id: dr.id },
      data: { penaltiesJson: JSON.stringify(penalties) },
    })
    updated++
    console.log(`  Updated ${dr.riderId}: distance=${penalties.distance}, segment=${penalties.segment}`)
  }

  console.log(`\nUpdated ${updated} driver results with distance + segment values`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
