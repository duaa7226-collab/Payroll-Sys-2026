'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Users, DollarSign, ArrowUpRight, ArrowDownRight,
  Plus, Upload, Settings, Search, Download, Pencil, Trash2, AlertCircle,
  CheckCircle2, Building2, Car, FileSpreadsheet, RefreshCw, Calculator, ChevronDown, ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function IncomeExpensesView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [company, setCompany] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [tab, setTab] = useState<'summary' | 'drivers' | 'expenses' | 'import'>('summary')
  const [importOpen, setImportOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [driverCountOpen, setDriverCountOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [detailDriver, setDetailDriver] = useState<any>(null)

  const reload = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('month', month)
    if (company) params.set('company', company)
    if (driverSearch) params.set('driver', driverSearch)
    fetch(`/api/income-expenses/dashboard?${params.toString()}`)
      .then(async r => {
        const text = await r.text()
        if (!text) return null
        try { return JSON.parse(text) } catch { return null }
      })
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [month, company, driverSearch])

  useEffect(() => { reload() }, [reload])

  const months = data?.months ?? []
  const companies = data?.companies ?? []
  const summary = data?.summary
  const driverResults = data?.driverResults ?? []
  const incomeByCompany = data?.incomeByCompany ?? []
  const expenseByCategory = data?.expenseByCategory ?? []
  const expenseAllocation = data?.expenseAllocation

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Driver Income vs Expenses
            <span className="text-base font-normal text-muted-foreground" dir="rtl">
              · دخل ومصروفات السائقين
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import monthly income from delivery companies, track expenses, and calculate net profit per driver.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoriesOpen(true)}>
            <Settings className="mr-1 h-4 w-4" /> Categories
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDriverCountOpen(true)}>
            <Users className="mr-1 h-4 w-4" /> Driver Count
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add Expense
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Import Income
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-glow">
        <CardContent className="flex flex-wrap items-end gap-3 p-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.length > 0 ? months.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                )) : (
                  <SelectItem value={month}>{month} (no data yet)</SelectItem>
                )}
                {/* Allow free month via input */}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery Company</Label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Driver Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by rider ID or name..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'summary', label: 'Monthly Summary', icon: TrendingUp },
          { id: 'drivers', label: 'Driver Details', icon: Users },
          { id: 'expenses', label: 'Expenses', icon: DollarSign },
        ].map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : !summary || summary.activeDrivers === 0 ? (
        <Card className="card-glow">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileSpreadsheet className="mx-auto h-10 w-10 opacity-40 mb-2" />
            No income data for {month}. Click "Import Income" to upload an Excel file.
          </CardContent>
        </Card>
      ) : tab === 'summary' ? (
        <MonthlySummary
          summary={summary}
          incomeByCompany={incomeByCompany}
          expenseByCategory={expenseByCategory}
          expenseAllocation={expenseAllocation}
          activeDriverCount={data?.activeDriverCount ?? 0}
          month={month}
        />
      ) : tab === 'drivers' ? (
        <DriverDetails
          driverResults={driverResults}
          onDetail={setDetailDriver}
        />
      ) : (
        <ExpensesList month={month} onReload={reload} />
      )}

      {/* Dialogs */}
      {importOpen && (
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reload} defaultMonth={month} />
      )}
      {expenseOpen && (
        <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={reload} defaultMonth={month} />
      )}
      {driverCountOpen && (
        <DriverCountDialog open={driverCountOpen} onOpenChange={setDriverCountOpen} onSaved={reload} month={month} />
      )}
      {categoriesOpen && (
        <CategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      )}
      {detailDriver && (
        <DriverDetailDialog driver={detailDriver} month={month} onOpenChange={(v) => !v && setDetailDriver(null)} />
      )}
    </div>
  )
}

// ============================================================================
// MONTHLY SUMMARY (PAGE 1)
// ============================================================================

function MonthlySummary({ summary, incomeByCompany, expenseByCategory, expenseAllocation, activeDriverCount, month }: any) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Active Drivers" value={summary.activeDrivers} icon={Users} color="text-blue-600" bg="bg-blue-500/10" />
        <SummaryCard label="Total Income" value={`SAR ${fmt(summary.totalIncome)}`} icon={ArrowUpRight} color="text-emerald-600" bg="bg-emerald-500/10" />
        <SummaryCard label="Total Expenses" value={`SAR ${fmt(summary.totalExpenses)}`} icon={ArrowDownRight} color="text-rose-600" bg="bg-rose-500/10" />
        <SummaryCard
          label="Net Profit"
          value={`SAR ${fmt(summary.totalNetProfit)}`}
          icon={summary.totalNetProfit >= 0 ? TrendingUp : TrendingDown}
          color={summary.totalNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          bg={summary.totalNetProfit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
        />
        <SummaryCard
          label="Avg Net / Driver"
          value={`SAR ${fmt(summary.avgNetPerDriver)}`}
          icon={Calculator}
          color={summary.avgNetPerDriver >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          bg="bg-muted"
        />
        <div className="grid grid-cols-2 gap-2">
          <MiniCard label="Profitable" value={summary.profitableCount} color="text-emerald-600" />
          <MiniCard label="Loss" value={summary.unprofitableCount} color="text-rose-600" />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Active driver count for {month}: <strong>{activeDriverCount}</strong> (used for shared expense allocation)
      </div>

      {/* Income by company + Expenses by category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Income by Delivery Company
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Company</th>
                  <th className="py-2 px-3 text-right font-medium">Drivers</th>
                  <th className="py-2 px-3 text-right font-medium">Income</th>
                  <th className="py-2 px-3 text-right font-medium">Expenses</th>
                  <th className="py-2 px-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {incomeByCompany.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-2 px-3 font-medium">{c.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{c.driverCount}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-600">{fmt(c.income)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-rose-600">{fmt(c.expenses)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${c.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(c.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Category</th>
                  <th className="py-2 px-3 text-right font-medium">Amount (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {expenseByCategory.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-2 px-3 font-medium">{c.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{fmt(c.amount)}</td>
                  </tr>
                ))}
                {expenseByCategory.length === 0 && (
                  <tr><td colSpan={2} className="py-4 text-center text-muted-foreground text-xs">No expenses recorded for this month</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Expense allocation breakdown */}
      {expenseAllocation && (
        <Card className="card-glow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Expense Allocation Breakdown</CardTitle>
            <CardDescription className="text-xs">How expenses are distributed across drivers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Per Driver</div>
                <div className="text-lg font-bold tabular-nums">SAR {fmt(expenseAllocation.per_driver)}</div>
                <div className="text-[10px] text-muted-foreground">Charged to each driver individually</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shared (Total)</div>
                <div className="text-lg font-bold tabular-nums">SAR {fmt(expenseAllocation.shared)}</div>
                <div className="text-[10px] text-muted-foreground">÷ {activeDriverCount} drivers = SAR {fmt(expenseAllocation.shared / (activeDriverCount || 1))} per driver</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</div>
                <div className="text-lg font-bold tabular-nums">SAR {fmt(expenseAllocation.assigned)}</div>
                <div className="text-[10px] text-muted-foreground">Charged to specific drivers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="card-glow">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className={`grid h-9 w-9 place-items-center rounded-lg ${bg} ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-lg font-bold tabular-nums">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniCard({ label, value, color }: any) {
  return (
    <Card className="card-glow">
      <CardContent className="p-3">
        <div className={`text-[10px] uppercase tracking-wider ${color}`}>{label}</div>
        <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// DRIVER DETAILS (PAGE 2)
// ============================================================================

function DriverDetails({ driverResults, onDetail }: any) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <Card className="card-glow">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="py-3 px-3 font-medium"></th>
                <th className="py-3 px-3 text-left font-medium">Rider ID</th>
                <th className="py-3 px-3 text-left font-medium">Driver Name</th>
                <th className="py-3 px-3 text-left font-medium">Company</th>
                <th className="py-3 px-3 text-right font-medium">Basic Pay</th>
                <th className="py-3 px-3 text-right font-medium">Distance</th>
                <th className="py-3 px-3 text-right font-medium">Segment</th>
                <th className="py-3 px-3 text-right font-medium">Penalties</th>
                <th className="py-3 px-3 text-right font-medium">Rider Bal.</th>
                <th className="py-3 px-3 text-right font-medium">Total Income</th>
                <th className="py-3 px-3 text-right font-medium">Per-Driver Exp.</th>
                <th className="py-3 px-3 text-right font-medium">Shared Exp.</th>
                <th className="py-3 px-3 text-right font-medium">Assigned Exp.</th>
                <th className="py-3 px-3 text-right font-medium">Total Exp.</th>
                <th className="py-3 px-3 text-right font-medium">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {driverResults.map((d: any) => {
                const isExpanded = expanded === d.id
                return (
                  <>
                    <tr key={d.id} className="border-t border-border/60 hover:bg-muted/30">
                      <td className="py-2 px-3">
                        <button
                          onClick={() => setExpanded(isExpanded ? null : d.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs">{d.riderId}</td>
                      <td className="py-2 px-3 font-medium">{d.driverName}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className="text-[9px]">{d.companyName}</Badge></td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.income.basicPayment)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.income.distancePayment)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.income.segmentPayment)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-rose-600">-{fmt(d.income.totalPenalties)}</td>
                      <td className={`py-2 px-3 text-right tabular-nums ${d.income.riderBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {d.income.riderBalance >= 0 ? '+' : ''}{fmt(d.income.riderBalance)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-emerald-600">{fmt(d.income.totalIncome)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.expenses.perDriverTotal)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.expenses.sharedTotal)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(d.expenses.assignedTotal)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-rose-600">{fmt(d.expenses.totalExpenses)}</td>
                      <td className={`py-2 px-3 text-right tabular-nums font-bold ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {fmt(d.netProfit)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={d.id + '-detail'} className="bg-muted/20">
                        <td colSpan={15} className="p-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            {/* Income breakdown */}
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">Income Breakdown</div>
                              <DetailRow label="Basic Payment" value={fmt(d.income.basicPayment)} />
                              <DetailRow label="Distance Payment" value={fmt(d.income.distancePayment)} />
                              <DetailRow label="Segment Payment" value={fmt(d.income.segmentPayment)} />
                              <DetailRow label="Total Penalties" value={`-${fmt(d.income.totalPenalties)}`} color="text-rose-600" />
                              <DetailRow label="Rider Balance" value={(d.income.riderBalance >= 0 ? '+' : '') + fmt(d.income.riderBalance)} color={d.income.riderBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                              {d.income.customFieldsTotal !== 0 && (
                                <DetailRow label="Custom Fields" value={fmt(d.income.customFieldsTotal)} />
                              )}
                              <div className="mt-2 pt-2 border-t font-semibold">
                                Total Income: <span className="text-emerald-600">{fmt(d.income.totalIncome)}</span>
                              </div>
                            </div>
                            {/* Expense breakdown */}
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2">Expense Breakdown</div>
                              {d.expenses.perDriverBreakdown.map((p: any, i: number) => (
                                <DetailRow key={i} label={p.categoryName + ' (per driver)'} value={fmt(p.amount)} />
                              ))}
                              {d.expenses.sharedBreakdown.map((s: any, i: number) => (
                                <DetailRow key={i} label={`${s.categoryName} (shared: ${fmt(s.totalAmount)} ÷ drivers)`} value={fmt(s.perDriver)} />
                              ))}
                              {d.expenses.assignedBreakdown.map((a: any, i: number) => (
                                <DetailRow key={i} label={`${a.categoryName} (assigned)`} value={fmt(a.amount)} />
                              ))}
                              <div className="mt-2 pt-2 border-t font-semibold">
                                Total Expenses: <span className="text-rose-600">{fmt(d.expenses.totalExpenses)}</span>
                              </div>
                            </div>
                            {/* Net profit */}
                            <div className="rounded-lg border-2 border-primary/30 p-3 bg-primary/5">
                              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Net Profit Calculation</div>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between"><span>Total Income</span><span className="text-emerald-600">+{fmt(d.income.totalIncome)}</span></div>
                                <div className="flex justify-between"><span>Total Expenses</span><span className="text-rose-600">-{fmt(d.expenses.totalExpenses)}</span></div>
                                <div className="flex justify-between font-bold text-base pt-2 border-t">
                                  <span>Net Profit</span>
                                  <span className={d.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                    {fmt(d.netProfit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value, color }: any) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-medium ${color || ''}`}>{value}</span>
    </div>
  )
}

// ============================================================================
// EXPENSES LIST TAB
// ============================================================================

function ExpensesList({ month, onReload }: any) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () => {
    setLoading(true)
    fetch(`/api/income-expenses/expenses?month=${month}`)
      .then(r => r.json())
      .then(d => setExpenses(d?.expenses ?? []))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [month])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const resp = await fetch(`/api/income-expenses/expenses?id=${id}`, { method: 'DELETE' })
    if (resp.ok) { toast.success('Deleted'); reload(); onReload() }
    else toast.error('Delete failed')
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="text-sm">Expenses for {month}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <DollarSign className="mx-auto h-10 w-10 opacity-40 mb-2" />
            No expenses recorded for {month}. Click "Add Expense" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="py-3 px-3 text-left font-medium">Category</th>
                <th className="py-3 px-3 text-left font-medium">Allocation Type</th>
                <th className="py-3 px-3 text-left font-medium">Assigned To</th>
                <th className="py-3 px-3 text-right font-medium">Amount (SAR)</th>
                <th className="py-3 px-3 text-left font-medium">Notes</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="py-2 px-3 font-medium">{e.categoryName}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-[9px]">
                      {e.allocationType === 'per_driver' ? 'Per Driver' : e.allocationType === 'shared' ? 'Shared' : 'Assigned'}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{e.assignedRiderId || '—'}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold">{fmt(e.amount)}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{e.notes}</td>
                  <td className="py-2 px-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// IMPORT DIALOG with column mapping + preview
// ============================================================================

function ImportDialog({ open, onOpenChange, onImported, defaultMonth }: any) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [companyName, setCompanyName] = useState('HungerStation')
  const [month, setMonth] = useState(defaultMonth)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'saving'>('upload')
  const [forceUpdate, setForceUpdate] = useState(false)

  const FIELDS = [
    { key: 'riderId', label: 'Rider ID *', ar: 'معرف المندوب' },
    { key: 'driverName', label: 'Driver Name', ar: 'اسم السائق' },
    { key: 'basicPayment', label: 'Basic Payment', ar: 'الدفعة الأساسية' },
    { key: 'distancePayment', label: 'Distance Payment', ar: 'بدل المسافة' },
    { key: 'segmentPayment', label: 'Segment Payment', ar: 'بدل الفئات' },
    { key: 'stackingDeduction', label: 'Stacking Deduction', ar: 'خصم الطلبات المتعددة' },
    { key: 'latePenalty', label: 'Late Penalty', ar: 'غرامة التأخير' },
    { key: 'noShowPenalty', label: 'No-Show Penalty', ar: 'غرامة عدم الحضور' },
    { key: 'missedDaysPenalty', label: 'Missed Days Penalty', ar: 'غرامة الأيام المفقودة' },
    { key: 'riderBalance', label: 'Rider Balance', ar: 'محفظة المندوب' },
  ]

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const XLSX = await import('xlsx')
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: null })
    if (jsonRows.length === 0) {
      toast.error('File is empty')
      return
    }
    const hdrs = Object.keys(jsonRows[0])
    setHeaders(hdrs)
    setRows(jsonRows)
    // Auto-map: try to match field labels
    const autoMap: Record<string, string> = {}
    for (const f of FIELDS) {
      const match = hdrs.find(h => {
        const hl = h.toLowerCase()
        return hl.includes(f.key.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()) ||
               hl.includes(f.label.toLowerCase().split(' ')[0]) ||
               (f.ar && h.includes(f.ar))
      })
      if (match) autoMap[f.key] = match
    }
    setMapping(autoMap)
    setStep('map')
  }

  const buildPreview = () => {
    if (!mapping.riderId) {
      toast.error('Rider ID column mapping is required')
      return
    }
    const mapped = rows.map(r => {
      const out: any = {}
      for (const [field, col] of Object.entries(mapping)) {
        out[field] = r[col]
      }
      // Ensure riderId is string
      out.riderId = String(out.riderId ?? '').trim()
      if (!out.driverName) out.driverName = `Rider ${out.riderId}`
      return out
    }).filter(r => r.riderId)
    setPreview(mapped)
    setStep('preview')
  }

  const handleSave = async () => {
    setStep('saving')
    try {
      const resp = await fetch('/api/income-expenses/import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          companyName,
          rows: preview,
          forceUpdate,
          sourceFile: file?.name,
        }),
      })
      const data = await resp.json()
      if (resp.ok) {
        toast.success(`Imported ${data.imported + data.updated} records (${data.imported} new, ${data.updated} updated)`)
        if (data.errors?.length > 0) {
          toast.warning(`${data.errors.length} warnings — check console`)
          console.log('Import warnings:', data.errors)
        }
        onOpenChange(false)
        onImported()
        // Reset
        setFile(null); setHeaders([]); setRows([]); setMapping({}); setPreview([]); setStep('upload')
      } else {
        if (data.duplicateRiderIds) {
          toast.error(`${data.duplicateRiderIds.length} duplicate records found. Enable "Overwrite existing" to update.`)
        } else {
          toast.error(data.error || data.message || 'Import failed')
        }
        setStep('preview')
      }
    } catch (e: any) {
      toast.error('Import failed: ' + e.message)
      setStep('preview')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Monthly Income</DialogTitle>
          <DialogDescription>
            Upload Excel/CSV from a delivery company, map columns, preview, and save.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Month (YYYY-MM)</Label>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Delivery Company</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="HungerStation" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Excel/CSV File</Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Supported: .xlsx, .xls, .csv. Arabic and English column headings are auto-detected.
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-3 py-2">
            <div className="text-xs">
              File: <strong>{file?.name}</strong> · {rows.length} rows · {headers.length} columns
            </div>
            <div className="rounded-lg border p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {FIELDS.map(f => (
                <div key={f.key} className="grid grid-cols-3 gap-2 items-center">
                  <div>
                    <div className="text-xs font-medium">{f.label}</div>
                    {f.ar && <div className="text-[9px] text-muted-foreground" dir="rtl">{f.ar}</div>}
                  </div>
                  <Select
                    value={mapping[f.key] || ''}
                    onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === '__none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— not mapped —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[9px] text-muted-foreground">
                    {mapping[f.key] ? '✓ mapped' : '—'}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>Back</Button>
              <Button size="sm" onClick={buildPreview}>Preview →</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 py-2">
            <div className="text-xs">
              {preview.length} rows ready to import for <strong>{companyName}</strong> in <strong>{month}</strong>
            </div>
            <div className="rounded-lg border max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="py-2 px-2 text-left">Rider ID</th>
                    <th className="py-2 px-2 text-left">Name</th>
                    <th className="py-2 px-2 text-right">Basic</th>
                    <th className="py-2 px-2 text-right">Distance</th>
                    <th className="py-2 px-2 text-right">Segment</th>
                    <th className="py-2 px-2 text-right">Penalties</th>
                    <th className="py-2 px-2 text-right">Rider Bal.</th>
                    <th className="py-2 px-2 text-right">Income</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => {
                    const totalPen = Math.abs(r.stackingDeduction||0) + Math.abs(r.latePenalty||0) + Math.abs(r.noShowPenalty||0) + Math.abs(r.missedDaysPenalty||0)
                    const income = (r.basicPayment||0) + (r.distancePayment||0) + (r.segmentPayment||0) - totalPen + (r.riderBalance||0)
                    return (
                      <tr key={i} className="border-t">
                        <td className="py-1 px-2 font-mono">{r.riderId}</td>
                        <td className="py-1 px-2">{r.driverName}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{fmt(r.basicPayment||0)}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{fmt(r.distancePayment||0)}</td>
                        <td className="py-1 px-2 text-right tabular-nums">{fmt(r.segmentPayment||0)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-rose-600">-{fmt(totalPen)}</td>
                        <td className={`py-1 px-2 text-right tabular-nums ${(r.riderBalance||0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(r.riderBalance||0)}</td>
                        <td className="py-1 px-2 text-right tabular-nums font-semibold">{fmt(income)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {preview.length > 50 && <div className="text-[10px] text-muted-foreground">Showing first 50 of {preview.length} rows</div>}
            <div className="flex items-center gap-2">
              <Switch checked={forceUpdate} onCheckedChange={setForceUpdate} />
              <Label className="text-xs">Overwrite existing records for this month/company</Label>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>Back</Button>
              <Button size="sm" onClick={handleSave}>Import {preview.length} rows</Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
            <div className="text-sm">Saving records...</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// EXPENSE DIALOG
// ============================================================================

function ExpenseDialog({ open, onOpenChange, onSaved, defaultMonth }: any) {
  const [categories, setCategories] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [month, setMonth] = useState(defaultMonth)
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [allocationType, setAllocationType] = useState('per_driver')
  const [assignedRiderId, setAssignedRiderId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/income-expenses/categories').then(r => r.json()).then(d => setCategories(d?.categories ?? []))
    fetch('/api/income-expenses/drivers').then(r => r.json()).then(d => setDrivers(d?.drivers ?? []))
  }, [])

  const selectedCat = categories.find(c => c.id === categoryId)

  const handleSave = async () => {
    if (!categoryId || !amount) { toast.error('Category and amount required'); return }
    setSaving(true)
    try {
      const resp = await fetch('/api/income-expenses/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month, categoryId, amount: parseFloat(amount),
          allocationType, assignedRiderId: allocationType === 'assigned' ? assignedRiderId : null,
          notes,
        }),
      })
      if (resp.ok) {
        toast.success('Expense created')
        onOpenChange(false); onSaved()
        setAmount(''); setNotes(''); setAssignedRiderId('')
      } else {
        const err = await resp.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
      }
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={categoryId} onValueChange={(v) => {
                setCategoryId(v)
                const c = categories.find(c => c.id === v)
                if (c) { setAllocationType(c.allocationType); setAmount(String(c.defaultAmount)) }
              }}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.allocationType})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (SAR)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" />
            </div>
            <div>
              <Label className="text-xs">Allocation Type</Label>
              <Select value={allocationType} onValueChange={setAllocationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_driver">Per Driver (charged to each)</SelectItem>
                  <SelectItem value="shared">Shared (÷ active drivers)</SelectItem>
                  <SelectItem value="assigned">Assigned (to one driver)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {allocationType === 'assigned' && (
            <div>
              <Label className="text-xs">Assigned to Driver</Label>
              <Select value={assignedRiderId} onValueChange={setAssignedRiderId}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map(d => <SelectItem key={d.riderId} value={d.riderId}>{d.name} ({d.riderId})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// DRIVER COUNT DIALOG
// ============================================================================

function DriverCountDialog({ open, onOpenChange, onSaved, month }: any) {
  const [count, setCount] = useState('')
  const [current, setCurrent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      fetch(`/api/income-expenses/driver-count?month=${month}`)
        .then(r => r.json())
        .then(d => { setCurrent(d?.driverCount); setCount(d?.driverCount?.activeDriverCount ? String(d.driverCount.activeDriverCount) : '') })
    }
  }, [open, month])

  const handleSave = async () => {
    if (!count || parseInt(count) <= 0) { toast.error('Count must be > 0'); return }
    setLoading(true)
    try {
      const resp = await fetch('/api/income-expenses/driver-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, activeDriverCount: parseInt(count), confirm }),
      })
      const data = await resp.json()
      if (resp.ok) {
        toast.success('Driver count saved')
        onOpenChange(false); onSaved()
      } else if (resp.status === 409) {
        toast.error(data.message)
        setConfirm(true)
      } else {
        toast.error(data.error || 'Save failed')
      }
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Active Driver Count — {month}</DialogTitle>
          <DialogDescription>
            Used to divide shared expenses. Changing this only affects {month}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {current && (
            <div className="text-xs text-muted-foreground">
              Current: <strong>{current.activeDriverCount}</strong> drivers (confirmed by {current.confirmedBy})
            </div>
          )}
          <div>
            <Label className="text-xs">Active Driver Count</Label>
            <Input type="number" value={count} onChange={(e) => { setCount(e.target.value); setConfirm(false) }} min="1" />
          </div>
          {confirm && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700">
              ⚠️ Confirm: This will recalculate shared allocations for {month} only. Other months stay unchanged.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// CATEGORIES DIALOG
// ============================================================================

function CategoriesDialog({ open, onOpenChange }: any) {
  const [categories, setCategories] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newType, setNewType] = useState('per_driver')

  const reload = () => {
    fetch('/api/income-expenses/categories').then(r => r.json()).then(d => setCategories(d?.categories ?? []))
  }

  useEffect(() => { if (open) reload() }, [open])

  const handleAdd = async () => {
    if (!newName) { toast.error('Name required'); return }
    const resp = await fetch('/api/income-expenses/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, defaultAmount: parseFloat(newAmount) || 0, allocationType: newType }),
    })
    if (resp.ok) {
      toast.success('Category added')
      setNewName(''); setNewAmount('')
      reload()
    } else {
      const err = await resp.json().catch(() => ({}))
      toast.error(err.error || 'Failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return
    await fetch(`/api/income-expenses/categories?id=${id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Expense Categories</DialogTitle>
          <DialogDescription>Add, view, or remove expense categories.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-xs font-medium">Add New Category</div>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="number" placeholder="Default amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_driver">Per Driver</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAdd}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          <div className="space-y-1">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <div className="font-medium">{c.name} {c.nameAr && <span className="text-muted-foreground" dir="rtl">· {c.nameAr}</span>}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Default: SAR {fmt(c.defaultAmount)} · {c.allocationType}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// DRIVER DETAIL DIALOG
// ============================================================================

function DriverDetailDialog({ driver, month, onOpenChange }: any) {
  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {driver.driverName} ({driver.riderId}) · {driver.companyName} · {month}
          </DialogTitle>
          <DialogDescription>Income and expense calculation details</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2 py-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">Income</div>
            <DetailRow label="Basic Payment" value={fmt(driver.income?.basicPayment || 0)} />
            <DetailRow label="Distance Payment" value={fmt(driver.income?.distancePayment || 0)} />
            <DetailRow label="Segment Payment" value={fmt(driver.income?.segmentPayment || 0)} />
            <DetailRow label="Total Penalties" value={`-${fmt(driver.income?.totalPenalties || 0)}`} color="text-rose-600" />
            <DetailRow label="Rider Balance" value={fmt(driver.income?.riderBalance || 0)} color={(driver.income?.riderBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <div className="mt-2 pt-2 border-t font-semibold">
              Total Income: <span className="text-emerald-600">{fmt(driver.income?.totalIncome || 0)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2">Expenses</div>
            {driver.expenses?.perDriverBreakdown?.map((p: any, i: number) => (
              <DetailRow key={i} label={p.categoryName} value={fmt(p.amount)} />
            ))}
            {driver.expenses?.sharedBreakdown?.map((s: any, i: number) => (
              <DetailRow key={i} label={`${s.categoryName} (shared)`} value={fmt(s.perDriver)} />
            ))}
            {driver.expenses?.assignedBreakdown?.map((a: any, i: number) => (
              <DetailRow key={i} label={`${a.categoryName} (assigned)`} value={fmt(a.amount)} />
            ))}
            <div className="mt-2 pt-2 border-t font-semibold">
              Total Expenses: <span className="text-rose-600">{fmt(driver.expenses?.totalExpenses || 0)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border-2 border-primary/30 p-4 bg-primary/5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs uppercase tracking-wider text-primary">Net Profit</div>
              <div className="text-[10px] text-muted-foreground">Total Income − Total Expenses</div>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${driver.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              SAR {fmt(driver.netProfit || 0)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
