// Re-sync IncomeRecords from DriverResult records (now that distance/segment are in penaltiesJson)
import { db } from '../src/lib/db'
import { calculateIncome } from '../src/lib/income-expenses-engine'

async function main() {
  // Find the latest payroll run
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run found'); return }
  console.log('Payroll run:', run.payrollMonth, '(', run.fileName, ')')

  // Convert payrollMonth label to YYYY-MM format
  // "October 2026" → "2026-10"
  const monthMap: Record<string, string> = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
  }
  const parts = run.payrollMonth.toLowerCase().replace('_', ' ').replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
  let month = ''
  for (let i = 0; i < parts.length; i++) {
    const m = monthMap[parts[i]]
    if (m) {
      const y = parts.find(p => /^\d{4}$/.test(p))
      month = `${y || new Date().getFullYear()}-${m}`
      break
    }
  }
  if (!month) {
    // Fallback: use current month
    month = new Date().toISOString().slice(0, 7)
  }
  console.log('Derived month key:', month)

  // Get all DriverResult records for this run
  const results = await db.driverResult.findMany({
    where: { payrollRunId: run.id },
    orderBy: { riderId: 'asc' },
  })
  console.log(`Found ${results.length} driver results`)

  const company = 'HungerStation'
  let updated = 0
  let created = 0

  for (const dr of results) {
    const penalties = JSON.parse(dr.penaltiesJson || '{}')
    
    // Find driver
    const driver = await db.driver.findUnique({ where: { riderId: dr.riderId } })

    const incomeData = {
      driverId: driver?.id || null,
      driverName: dr.driverName,
      companyName: company,
      basicPayment: dr.uploadedBasicPayment || 0,
      distancePayment: penalties.distance || 0,  // Now has the value!
      segmentPayment: penalties.segment || 0,     // Now has the value!
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
      importedBy: 'admin',
    }

    const calc = calculateIncome(incomeData)
    const fullData = { ...incomeData, totalIncome: calc.totalIncome, totalPenalties: calc.totalPenalties }

    // Check if IncomeRecord exists
    const existing = await db.incomeRecord.findUnique({
      where: { month_riderId_companyName: { month, riderId: dr.riderId, companyName: company } },
    })

    if (existing) {
      await db.incomeRecord.update({ where: { id: existing.id }, data: fullData })
      updated++
    } else {
      await db.incomeRecord.create({ data: { month, riderId: dr.riderId, ...fullData } })
      created++
    }

    if (dr.riderId === '4648308') {
      console.log(`\n=== Rider 4648308 (updated) ===`)
      console.log(`  basicPayment: ${incomeData.basicPayment}`)
      console.log(`  distancePayment: ${incomeData.distancePayment}`)
      console.log(`  segmentPayment: ${incomeData.segmentPayment}`)
      console.log(`  stackingDeduction: ${incomeData.stackingDeduction}`)
      console.log(`  riderBalance: ${incomeData.riderBalance}`)
      console.log(`  totalPenalties: ${calc.totalPenalties}`)
      console.log(`  totalIncome: ${calc.totalIncome}`)
      console.log(`  Expected: 4576 + 3885.19 + 1001 - 536.77 = 8925.42`)
    }
  }

  // Update driver count
  await db.driverCount.upsert({
    where: { month },
    create: { month, activeDriverCount: results.length, notes: `Re-synced from ${run.payrollMonth}`, confirmedBy: 'system-sync' },
    update: { activeDriverCount: results.length, notes: `Re-synced from ${run.payrollMonth}`, confirmedBy: 'system-sync' },
  })

  console.log(`\n=== Summary ===`)
  console.log(`Updated: ${updated}, Created: ${created}, Driver count: ${results.length}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
