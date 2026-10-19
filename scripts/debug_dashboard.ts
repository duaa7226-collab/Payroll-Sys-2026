import { db } from '../src/lib/db'
import { calculateIncome, calculateExpensesFromList, getActiveDriverCount } from '../src/lib/income-expenses-engine'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  console.log('Payroll month:', run.payrollMonth)
  
  // Derive month key
  const monthMap: Record<string, string> = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
  }
  const labelParts = run.payrollMonth.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
  console.log('Label parts:', labelParts)
  let monthKey = ''
  for (let i = 0; i < labelParts.length; i++) {
    const m = monthMap[labelParts[i]]
    if (m) {
      const y = labelParts.find(p => /^\d{4}$/.test(p)) || String(new Date().getFullYear())
      monthKey = `${y}-${m}`
      break
    }
  }
  console.log('Derived monthKey:', monthKey)
  
  // Check income records
  const incomeRecords = await db.incomeRecord.findMany({ where: { month: monthKey } })
  console.log('Income records for', monthKey, ':', incomeRecords.length)
  
  if (incomeRecords.length > 0) {
    const expenses = await db.expense.findMany({ where: { month: monthKey } })
    console.log('Expenses:', expenses.length)
    const activeDriverCount = await getActiveDriverCount(monthKey)
    console.log('Active driver count:', activeDriverCount)
    
    let totalIncome = 0, totalExpenses = 0
    for (const rec of incomeRecords) {
      const income = calculateIncome(rec)
      const expAlloc = calculateExpensesFromList(expenses, rec.riderId, activeDriverCount)
      totalIncome += income.totalIncome
      totalExpenses += expAlloc.totalExpenses
    }
    console.log('Total income:', totalIncome.toFixed(2))
    console.log('Total expenses:', totalExpenses.toFixed(2))
    console.log('Net profit:', (totalIncome - totalExpenses).toFixed(2))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
