import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run!'); return }
  console.log('Run:', run.payrollMonth, 'ruleSnapshot length:', run.ruleSnapshot?.length || 0)
  
  // Check ruleSnapshot for wrAmountExclVAT
  try {
    const snap = JSON.parse(run.ruleSnapshot || '{}')
    console.log('wrAmountExclVAT in snapshot:', snap.wrAmountExclVAT || 'NOT FOUND')
    console.log('snapshot keys:', Object.keys(snap).slice(0, 5))
  } catch (e) { console.log('ruleSnapshot parse error') }
  
  // Check income records
  const monthMap: Record<string, string> = {
    'january':'01','february':'02','march':'03','april':'04','may':'05','june':'06',
    'july':'07','august':'08','september':'09','october':'10','november':'11','december':'12',
  }
  const parts = run.payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/)
  let monthKey = ''
  for (let i=0;i<parts.length;i++){const m=monthMap[parts[i]];if(m){const y=parts.find(p=>/^\d{4}$/.test(p))||String(new Date().getFullYear());monthKey=`${y}-${m}`;break}}
  console.log('Derived monthKey:', monthKey)
  
  const incomeRecs = await db.incomeRecord.findMany({ where: { month: monthKey } })
  console.log('Income records for', monthKey, ':', incomeRecs.length)
  
  const expenses = await db.expense.findMany({ where: { month: monthKey } })
  console.log('Expenses:', expenses.length)
  
  const dc = await db.driverCount.findUnique({ where: { month: monthKey } })
  console.log('DriverCount:', dc?.activeDriverCount || 'NOT SET')
  
  // Check if calculateExpensesFromList is exported
  try {
    const mod = await import('../src/lib/income-expenses-engine')
    console.log('calculateExpensesFromList:', typeof mod.calculateExpensesFromList)
    console.log('calculateIncome:', typeof mod.calculateIncome)
  } catch (e: any) {
    console.log('Import error:', e.message)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
