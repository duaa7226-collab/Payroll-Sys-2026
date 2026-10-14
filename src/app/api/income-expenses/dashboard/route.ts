import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateIncome, calculateDriverExpenses, getActiveDriverCount } from '@/lib/income-expenses-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/dashboard?month=2026-08&company=HungerStation&driver=4643856
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const company = searchParams.get('company') || ''
    const driverFilter = searchParams.get('driver') || ''

    // Get all months that have data
    const allIncome = await db.incomeRecord.findMany({ select: { month: true }, distinct: ['month'] })
    const months = allIncome.map(r => r.month).sort().reverse()

    // Get all companies
    const allCompanies = await db.incomeRecord.findMany({ select: { companyName: true }, distinct: ['companyName'] })
    const companies = allCompanies.map(r => r.companyName).sort()

    // Active driver count
    const activeDriverCount = await getActiveDriverCount(month)

    // Fetch income records for the month
    const where: any = { month }
    if (company) where.companyName = company
    if (driverFilter) where.riderId = driverFilter
    const incomeRecords = await db.incomeRecord.findMany({ where, orderBy: { riderId: 'asc' } })

    // Fetch expenses for the month
    const expenses = await db.expense.findMany({ where: { month } })

    // Calculate per-driver results
    const driverResults = []
    for (const rec of incomeRecords) {
      const income = calculateIncome(rec)
      const expenseAlloc = await calculateDriverExpenses(month, rec.riderId, activeDriverCount)
      const netProfit = income.totalIncome - expenseAlloc.totalExpenses
      driverResults.push({
        id: rec.id,
        riderId: rec.riderId,
        driverName: rec.driverName,
        companyName: rec.companyName,
        income,
        expenses: expenseAlloc,
        netProfit,
      })
    }

    // Summary totals
    const totalIncome = driverResults.reduce((s, d) => s + d.income.totalIncome, 0)
    const totalExpenses = driverResults.reduce((s, d) => s + d.expenses.totalExpenses, 0)
    const totalNetProfit = driverResults.reduce((s, d) => s + d.netProfit, 0)
    const activeDrivers = driverResults.length
    const avgNetPerDriver = activeDrivers > 0 ? totalNetProfit / activeDrivers : 0
    const profitableCount = driverResults.filter(d => d.netProfit > 0).length
    const unprofitableCount = driverResults.filter(d => d.netProfit < 0).length

    // Income by company
    const incomeByCompanyMap = new Map<string, { income: number; expenses: number; net: number; driverCount: number }>()
    for (const d of driverResults) {
      const existing = incomeByCompanyMap.get(d.companyName) || { income: 0, expenses: 0, net: 0, driverCount: 0 }
      existing.income += d.income.totalIncome
      existing.expenses += d.expenses.totalExpenses
      existing.net += d.netProfit
      existing.driverCount++
      incomeByCompanyMap.set(d.companyName, existing)
    }
    const incomeByCompany = Array.from(incomeByCompanyMap.entries()).map(([name, v]) => ({ name, ...v }))

    // Expenses by category (sum totals across all drivers — for shared, use the total monthly amount)
    const expenseByCategoryMap = new Map<string, number>()
    for (const e of expenses) {
      expenseByCategoryMap.set(e.categoryName, (expenseByCategoryMap.get(e.categoryName) ?? 0) + e.amount)
    }
    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Expenses breakdown by allocation type
    const perDriverTotal = expenses.filter(e => e.allocationType === 'per_driver').reduce((s, e) => s + e.amount, 0)
    const sharedTotal = expenses.filter(e => e.allocationType === 'shared').reduce((s, e) => s + e.amount, 0)
    const assignedTotal = expenses.filter(e => e.allocationType === 'assigned').reduce((s, e) => s + e.amount, 0)

    return NextResponse.json({
      months,
      companies,
      activeDriverCount,
      month,
      driverResults,
      summary: {
        activeDrivers,
        totalIncome,
        totalExpenses,
        totalNetProfit,
        avgNetPerDriver,
        profitableCount,
        unprofitableCount,
      },
      incomeByCompany,
      expenseByCategory,
      expenseAllocation: {
        per_driver: perDriverTotal,
        shared: sharedTotal,
        assigned: assignedTotal,
        total: perDriverTotal + sharedTotal + assignedTotal,
      },
    })
  } catch (err: any) {
    console.error('GET /api/income-expenses/dashboard failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message }, { status: 500 })
  }
}
