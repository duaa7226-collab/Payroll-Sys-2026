'use client'

import { useEffect, useState } from 'react'
import {
  Users, Wallet, TrendingUp, TrendingDown, Target, CarFront,
  AlertTriangle, Crown, Zap, Activity, FileText, Download,
  ArrowUpRight, ArrowDownRight, Layers, Award
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar,
  Legend, ScatterChart, Scatter, ZAxis, ComposedChart, Line
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const COLORS = ['#16a34a', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f43f5e', '#facc15']

const PENALTY_LABELS: Record<string, string> = {
  acceptance: 'Acceptance',
  contact: 'Contact',
  stacking: 'Stacking',
  declined: 'Declined',
  late: 'Late',
  noshow: 'No-Show',
  noshow_special: 'No-Show Special',
  daily_acceptance: 'Daily Acceptance',
  missed_days: 'Missed Days',
  rider_balance: 'Rider Balance',
  car_deduction: 'Car Deduction',
  tga_deduction: 'TGA Deduction',
}

const BAND_LABELS: Record<string, string> = {
  top: 'Top Performer',
  high: 'High',
  average: 'Average',
  low: 'Low',
  bottom: 'Bottom',
}

const VARIANCE_LABELS: Record<string, string> = {
  ok: 'Within Tolerance',
  minor: 'Minor Variance',
  major: 'Major Variance',
  review: 'Needs Review',
}

export function DashboardView({ runId, setRunId, onNavigate }: {
  runId: string | null
  setRunId: (id: string) => void
  onNavigate: (tab: any) => void
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    queueMicrotask(() => setLoading(true))
    const url = runId ? `/api/dashboard?runId=${runId}` : '/api/dashboard'
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d?.run) {
          setData(d)
          setRunId(d.run.id)
        }
      })
      .finally(() => setLoading(false))
  }, [runId])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 shimmer rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 shimmer rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-80 shimmer rounded-xl" />)}
        </div>
      </div>
    )
  }

  const { kpis, charts, ruleSummary, run, allRuns } = data

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              LIVE
            </span>
            <span>Payroll Month</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {run.payrollMonth} · Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {kpis.totalDrivers} drivers · {kpis.totalContracts} contract(s) ·{' '}
            {ruleSummary.salaryMode === 'orders_based_mode' ? 'Orders-Based Mode' : 'Days-Prorated Mode'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={runId ?? run.id} onValueChange={(v) => setRunId(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select run" />
            </SelectTrigger>
            <SelectContent>
              {allRuns.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.payrollMonth} · {r.totalDrivers} drivers
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => onNavigate('import')}>
            <Download className="mr-1 h-4 w-4" /> New Import
          </Button>
        </div>
      </div>

      {/* KPI Cards — Premium 2026 style */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Net Salary"
          titleAr="صافي الرواتب"
          value={`SAR ${kpis.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Wallet}
          trend="+8.2%"
          trendUp
          accent="emerald"
          subtitle={`Gross: SAR ${kpis.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <KpiCard
          title="Total Drivers"
          titleAr="إجمالي السائقين"
          value={kpis.totalDrivers.toString()}
          icon={Users}
          accent="violet"
          subtitle={`${kpis.totalWorkingDays.toFixed(0)} working days`}
        />
        <KpiCard
          title="Total Penalties"
          titleAr="إجمالي الغرامات"
          value={`SAR ${kpis.totalPenalties.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingDown}
          accent="amber"
          trend={`${kpis.driversRequiringReview} flagged`}
          trendUp={false}
          subtitle={`Traffic: SAR ${kpis.totalTraffic.toFixed(0)}`}
        />
        <KpiCard
          title="Completed Orders"
          titleAr="الطلبات المكتملة"
          value={kpis.totalCompletedOrders.toLocaleString()}
          icon={Target}
          accent="cyan"
          trend={`${(kpis.totalCompletedOrders / (ruleSummary.monthlyTargetOrders * kpis.totalDrivers) * 100).toFixed(1)}% of target`}
          trendUp
          subtitle={`Target: ${(ruleSummary.monthlyTargetOrders * kpis.totalDrivers).toLocaleString()}`}
        />
      </div>

      {/* Secondary KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpi
          label="Highest Paid"
          value={kpis.highestPaidDriver?.name ?? '—'}
          amount={kpis.highestPaidDriver ? `SAR ${kpis.highestPaidDriver.amount.toFixed(2)}` : ''}
          icon={Crown}
          tone="emerald"
        />
        <MiniKpi
          label="Highest Penalty"
          value={kpis.highestPenaltyDriver?.name ?? '—'}
          amount={kpis.highestPenaltyDriver ? `SAR ${kpis.highestPenaltyDriver.amount.toFixed(2)}` : ''}
          icon={Zap}
          tone="amber"
        />
        <MiniKpi
          label="Drivers Needing Review"
          value={`${kpis.driversRequiringReview}`}
          amount={`of ${kpis.totalDrivers}`}
          icon={AlertTriangle}
          tone="rose"
        />
        <MiniKpi
          label="Total Variance"
          value={`SAR ${kpis.totalVariance.toFixed(2)}`}
          amount="abs total"
          icon={Activity}
          tone="violet"
        />
      </div>

      {/* Active Rule Summary banner */}
      <Card className="card-glow border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <Layers className="h-4 w-4 text-emerald-600" />
              {ruleSummary.ruleSetName}
            </div>
            <RuleBadge label="Mode" value={ruleSummary.salaryMode === 'orders_based_mode' ? 'Orders-Based' : 'Days-Prorated'} />
            <RuleBadge label="Base Salary" value={`SAR ${ruleSummary.monthlyBaseSalary}`} />
            <RuleBadge label="Std Days" value={ruleSummary.standardWorkingDays} />
            <RuleBadge label="Monthly Target" value={ruleSummary.monthlyTargetOrders} />
            <RuleBadge label="Daily Target" value={`${ruleSummary.dailyTargetRate.toFixed(1)} orders`} />
            <RuleBadge label="Per Order" value={`SAR ${ruleSummary.salaryPerOrderRate.toFixed(4)}`} />
            <RuleBadge label="Bonus/Extra" value={`SAR ${ruleSummary.bonusPerExtraOrder}`} />
            <RuleBadge label="Deduct/Missing" value={`SAR ${ruleSummary.deductionPerMissingOrder}`} />
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onNavigate('rules')}>
              Edit Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Salary by Driver — Top 10 */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Top 10 Drivers by Net Salary
              </span>
              <Badge variant="outline" className="text-[10px]">{charts.top10.length}</Badge>
            </CardTitle>
            <CardDescription>Highest paid drivers for {run.payrollMonth}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.top10} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.92 0.005 250)" />
                <XAxis type="number" tickFormatter={(v) => `SAR ${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`SAR ${v.toFixed(2)}`, 'Net Salary']}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
                <Bar dataKey="net" radius={[0, 6, 6, 0]}>
                  {charts.top10.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Penalty Breakdown */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Penalty Breakdown by Type
            </CardTitle>
            <CardDescription>Total deductions grouped by penalty category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.penaltyBreakdown} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.005 250)" />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} tickFormatter={(v) => PENALTY_LABELS[v] ?? v} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis tickFormatter={(v) => `SAR ${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`SAR ${v.toFixed(2)}`, 'Amount']}
                  labelFormatter={(l) => PENALTY_LABELS[l as string] ?? l}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {charts.penaltyBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders vs Target scatter */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              Completed Orders vs Adjusted Target
            </CardTitle>
            <CardDescription>Bubble size = Net Salary · diagonal = perfect attainment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ left: -10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis
                  type="number"
                  dataKey="target"
                  name="Target"
                  tickFormatter={(v) => v.toFixed(0)}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Adjusted Target', position: 'insideBottom', offset: -5, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="completed"
                  name="Completed"
                  tickFormatter={(v) => v.toFixed(0)}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Completed', angle: -90, position: 'insideLeft', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="net" range={[80, 400]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v: any, n: any) => n === 'net' ? [`SAR ${v.toFixed(2)}`, 'Net'] : [v, n]}
                  labelFormatter={() => ''}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
                <Scatter data={charts.ordersVsTarget} fill="#8b5cf6" fillOpacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Band distribution */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" />
              Driver Performance Bands
            </CardTitle>
            <CardDescription>Distribution based on target attainment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={charts.performanceBands}
                  dataKey="count"
                  nameKey="band"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                  label={(e: any) => `${BAND_LABELS[e.band] ?? e.band}: ${e.count}`}
                  labelLine={false}
                >
                  {charts.performanceBands.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, _: any, p: any) => [`${v} drivers`, BAND_LABELS[p.payload.band] ?? p.payload.band]}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bottom 10 drivers */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              Bottom 10 Drivers by Net Salary
            </CardTitle>
            <CardDescription>Lowest paid drivers — may need review</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.bottom10} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.92 0.005 250)" />
                <XAxis type="number" tickFormatter={(v) => `SAR ${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`SAR ${v.toFixed(2)}`, 'Net Salary']}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
                <Bar dataKey="net" radius={[0, 6, 6, 0]} fill="#f43f5e" fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Variance status pie */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              Variance & Review Status
            </CardTitle>
            <CardDescription>Calculated vs uploaded basic payment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={charts.varianceStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(e: any) => `${VARIANCE_LABELS[e.status] ?? e.status}: ${e.count}`}
                  labelLine={false}
                >
                  {charts.varianceStatus.map((entry: any, i: number) => {
                    const color = entry.status === 'ok' ? '#16a34a'
                      : entry.status === 'minor' ? '#f59e0b'
                      : entry.status === 'major' ? '#f43f5e'
                      : '#8b5cf6'
                    return <Cell key={i} fill={color} />
                  })}
                </Pie>
                <Tooltip
                  formatter={(v: any, _: any, p: any) => [`${v} drivers`, VARIANCE_LABELS[p.payload.status] ?? p.payload.status]}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Working days vs Net salary + Traffic */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              Working Days vs Net Salary
            </CardTitle>
            <CardDescription>Does more working days translate to higher net pay?</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={charts.workingDaysVsNet} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis dataKey="workingDays" tick={{ fontSize: 11 }} label={{ value: 'Working Days', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `SAR ${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`SAR ${v.toFixed(2)}`, 'Net Salary']}
                  labelFormatter={(_, p: any) => `Driver: ${p[0]?.payload?.name ?? ''}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                />
                <Bar dataKey="net" radius={[6, 6, 0, 0]} fill="#06b6d4" fillOpacity={0.7} />
                <Line type="monotone" dataKey="net" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFront className="h-4 w-4 text-rose-500" />
              Traffic Violations by Driver
            </CardTitle>
            <CardDescription>Approved tickets included as payroll deductions</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.trafficByDriver.length === 0 ? (
              <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">
                <div className="text-center">
                  <CarFront className="mx-auto h-10 w-10 opacity-40" />
                  <p className="mt-2">No traffic violations recorded</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.trafficByDriver} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.005 250)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `SAR ${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any) => [`SAR ${v.toFixed(2)}`, 'Traffic Deduction']}
                    contentStyle={{ borderRadius: 8, border: '1px solid oklch(0.92 0.005 250)', fontSize: 12 }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contract summary table */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle>Contract Summary</CardTitle>
          <CardDescription>Aggregate payroll by contract</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Contract</th>
                  <th className="py-2 px-4 font-medium text-right">Drivers</th>
                  <th className="py-2 px-4 font-medium text-right">Orders</th>
                  <th className="py-2 px-4 font-medium text-right">Gross (SAR)</th>
                  <th className="py-2 px-4 font-medium text-right">Penalties (SAR)</th>
                  <th className="py-2 px-4 font-medium text-right">Net (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {charts.byContract.map((c: any) => (
                  <tr key={c.contract} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">{c.contract}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.drivers}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.orders.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.gross.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-rose-600">{c.penalties.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-emerald-600">{c.net.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  title, titleAr, value, icon: Icon, trend, trendUp, accent, subtitle,
}: {
  title: string
  titleAr?: string
  value: string
  icon: any
  trend?: string
  trendUp?: boolean
  accent: 'emerald' | 'violet' | 'amber' | 'cyan' | 'rose'
  subtitle?: string
}) {
  const accentMap = {
    emerald: 'from-emerald-500/15 to-emerald-500/0 text-emerald-700 dark:text-emerald-300',
    violet: 'from-violet-500/15 to-violet-500/0 text-violet-700 dark:text-violet-300',
    amber: 'from-amber-500/15 to-amber-500/0 text-amber-700 dark:text-amber-300',
    cyan: 'from-cyan-500/15 to-cyan-500/0 text-cyan-700 dark:text-cyan-300',
    rose: 'from-rose-500/15 to-rose-500/0 text-rose-700 dark:text-rose-300',
  }
  return (
    <Card className={cn('card-glow overflow-hidden relative')}>
      <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', accentMap[accent])} />
      <CardContent className="relative p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
            {titleAr && (
              <div className="text-[10px] text-muted-foreground/70 mt-0.5" style={{ fontFamily: 'var(--font-arabic)' }} dir="rtl">{titleAr}</div>
            )}
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-card/80 backdrop-blur shadow-sm">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {trend && (
            <span className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              trendUp ? 'text-emerald-600' : 'text-rose-600'
            )}>
              {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </span>
          )}
          {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function MiniKpi({ label, value, amount, icon: Icon, tone }: {
  label: string
  value: string
  amount: string
  icon: any
  tone: 'emerald' | 'amber' | 'rose' | 'violet'
}) {
  const toneMap = {
    emerald: 'text-emerald-600 bg-emerald-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
  }
  return (
    <Card className="card-glow">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="truncate font-semibold text-sm">{value}</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">{amount}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function RuleBadge({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
