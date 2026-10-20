// Update the latest payroll run: sync income records + WR Amount Excl. VAT + default expenses
import { db } from '../src/lib/db'
import { calculateIncome } from '../src/lib/income-expenses-engine'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run found'); return }
  console.log('Payroll run:', run.payrollMonth, '(', run.fileName, ')')

  // Derive month key (handle abbreviated months like "Sep 2026")
  const monthMap: Record<string, string> = {
    'jan':'01','january':'01','feb':'02','february':'02','mar':'03','march':'03','apr':'04','april':'04',
    'may':'05','jun':'06','june':'06','jul':'07','july':'07','aug':'08','august':'08',
    'sep':'09','sept':'09','september':'09','oct':'10','october':'10','nov':'11','november':'11','dec':'12','december':'12',
  }
  const parts = run.payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
  let monthKey = ''
  for (let i = 0; i < parts.length; i++) {
    const m = monthMap[parts[i]]
    if (m) {
      const y = parts.find(p => /^\d{4}$/.test(p)) || String(new Date().getFullYear())
      monthKey = `${y}-${m}`
      break
    }
  }
  if (!monthKey) { console.log('Could not derive month key from:', run.payrollMonth); return }
  console.log('Derived month key:', monthKey)

  // 1. Update WR Amount Excl. VAT
  let wrAmountExclVAT = 0
  const uploadDir = '/home/z/my-project/upload'
  const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []
  for (const f of files) {
    if (!f.endsWith('.xlsx')) continue
    try {
      const fp = `${uploadDir}/${f}`
      const buf = fs.readFileSync(fp)
      const wb = XLSX.read(buf, { type: 'buffer' })
      const wrSheet = wb.SheetNames.find(n => n.toLowerCase() === 'wr' || n.toLowerCase().includes('wr'))
      if (!wrSheet) continue
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wrSheet], { defval: null })
      if (rows.length === 0) continue
      const headers = Object.keys(rows[0])
      const amountCol = headers.find(h => h.includes('Excl') || h.includes('غير شامل') || h.includes('قبل الضريبة') || h.includes('بدون ضريبة'))
      if (amountCol) {
        wrAmountExclVAT = parseFloat(String(rows[0][amountCol])) || 0
        console.log(`  Found WR Amount Excl. VAT: ${wrAmountExclVAT} (from ${f}, column: "${amountCol}")`)
        break
      }
    } catch {}
  }

  // Store WR amount in ruleSnapshot
  const snapshot = JSON.parse(run.ruleSnapshot || '{}')
  snapshot.wrAmountExclVAT = wrAmountExclVAT
  await db.payrollRun.update({ where: { id: run.id }, data: { ruleSnapshot: JSON.stringify(snapshot) } })

  // 2. Sync income records from DriverResult
  const results = await db.driverResult.findMany({ where: { payrollRunId: run.id }, orderBy: { riderId: 'asc' } })
  const company = 'HungerStation'
  await db.incomeRecord.deleteMany({ where: { month: monthKey, companyName: company } })
  
  let incomeCount = 0
  for (const dr of results) {
    const driver = await db.driver.findUnique({ where: { riderId: dr.riderId } })
    const penalties = JSON.parse(dr.penaltiesJson || '{}')
    const incomeData = {
      driverId: driver?.id || null,
      driverName: dr.driverName,
      companyName: company,
      basicPayment: dr.uploadedBasicPayment || 0,
      distancePayment: penalties.distance || 0,
      segmentPayment: penalties.segment || 0,
      acceptancePenalty: penalties.acceptance || 0,
      contactPenalty: penalties.contact || 0,
      stackingDeduction: penalties.stacking || 0,
      declinedPenalty: penalties.declined || 0,
      latePenalty: penalties.late || 0,
      noShowPenalty: penalties.noshow || 0,
      noShowSpecialPenalty: penalties.noshow_special || 0,
      dailyAcceptancePenalty: penalties.daily_acceptance || 0,
      missedDaysPenalty: penalties.missed_days || 0,
      riderBalance: penalties.rider_balance || 0,
      customFieldsJson: null,
      sourceFile: run.fileName,
      importedBy: 'auto-sync',
    }
    const calc = calculateIncome(incomeData)
    await db.incomeRecord.create({
      data: { month: monthKey, riderId: dr.riderId, ...incomeData, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties },
    })
    incomeCount++
  }
  console.log(`  Synced ${incomeCount} income records`)

  // 3. Set driver count
  await db.driverCount.upsert({
    where: { month: monthKey },
    create: { month: monthKey, activeDriverCount: results.length, notes: `Auto-synced from ${run.payrollMonth}`, confirmedBy: 'auto-sync' },
    update: { activeDriverCount: results.length, notes: `Auto-synced from ${run.payrollMonth}`, confirmedBy: 'auto-sync' },
  })
  console.log(`  Driver count: ${results.length}`)

  // 4. Auto-seed default expenses
  const DEFAULT_EXPENSES = [
    { name: 'Iqama', amount: 1000, type: 'per_driver' },
    { name: 'Petrol', amount: 1200, type: 'per_driver' },
    { name: 'Car rent', amount: 1500, type: 'per_driver' },
    { name: 'Internet', amount: 115, type: 'per_driver' },
    { name: 'Office', amount: 18000, type: 'shared' },
    { name: 'Accommodation / flat', amount: 12000, type: 'shared' },
    { name: 'Saudis salary and insurance', amount: 12900, type: 'shared' },
    { name: 'Electricity and water', amount: 1000, type: 'shared' },
  ]
  const existingExp = await db.expense.findMany({ where: { month: monthKey }, select: { categoryName: true } })
  const existingCats = new Set(existingExp.map(e => e.categoryName))
  const allCats = await db.expenseCategory.findMany()
  let expenseCount = 0
  for (const def of DEFAULT_EXPENSES) {
    if (!existingCats.has(def.name)) {
      let cat = allCats.find(c => c.name === def.name)
      if (!cat) cat = await db.expenseCategory.create({ data: { name: def.name, defaultAmount: def.amount, allocationType: def.type } })
      await db.expense.create({ data: { month: monthKey, categoryId: cat.id, categoryName: cat.name, amount: def.amount, allocationType: def.type, notes: 'Auto-seeded', createdBy: 'auto-sync' } })
      expenseCount++
    }
  }
  console.log(`  Expenses: ${existingExp.length} existing + ${expenseCount} new = ${existingExp.length + expenseCount} total`)

  // 5. Summary
  const incomeRecs = await db.incomeRecord.findMany({ where: { month: monthKey } })
  let totalIncome = 0
  for (const rec of incomeRecs) {
    const calc = calculateIncome(rec)
    totalIncome += calc.totalIncome
  }
  // If WR Amount Excl. VAT is available, use it as total income
  if (wrAmountExclVAT > 0) totalIncome = wrAmountExclVAT
  const expenses2 = await db.expense.findMany({ where: { month: monthKey } })
  const totalExpenses = expenses2.reduce((s, e) => s + e.amount, 0)
  console.log(`\n=== Summary ===`)
  console.log(`  Total Income: ${totalIncome.toFixed(2)} SAR ${wrAmountExclVAT > 0 ? '(from WR Amount Excl. VAT)' : '(calculated)'}`)
  console.log(`  Total Expenses: ${totalExpenses.toFixed(2)} SAR`)
  console.log(`  Net Profit: ${(totalIncome - totalExpenses).toFixed(2)} SAR`)
  console.log(`  Drivers: ${results.length}`)
  console.log(`  Done! ✅`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
