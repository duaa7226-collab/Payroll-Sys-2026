'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Users, Search, ArrowUpDown, FileText, AlertTriangle, CheckCircle2,
  ChevronRight, X, Download, FileSpreadsheet, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { PayslipPreview } from './payslip-preview'
import { safeFetchJson } from '@/lib/safe-fetch'
import { exportDriversToExcel } from '@/lib/excel-export'
import { cn } from '@/lib/utils'

const BAND_LABELS: Record<string, string> = {
  top: 'Top',
  high: 'High',
  average: 'Average',
  low: 'Low',
  bottom: 'Bottom',
}
const BAND_COLORS: Record<string, string> = {
  top: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  high: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  average: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  low: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bottom: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

export function DriversView({ runId, setRunId, onNavigate }: {
  runId: string | null
  setRunId: (id: string) => void
  onNavigate: (tab: any) => void
}) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('net_desc')
  const [band, setBand] = useState('all')
  const [review, setReview] = useState('all')
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [payslipOpen, setPayslipOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      let ruleSummary = null
      try {
        const data = await safeFetchJson('/api/rules?active=true', null)
        if (data?.snapshot) {
          const s = data.snapshot
          ruleSummary = {
            salaryMode: s.salary_mode === 'orders_based_mode' ? 'Orders-Based' : 'Days-Prorated',
            monthlyBaseSalary: s.monthly_base_salary,
            standardWorkingDays: s.standard_working_days,
            monthlyTargetOrders: s.monthly_target_orders,
            dailyTargetRate: (s.monthly_target_orders / s.standard_working_days),
            salaryPerOrderRate: (s.monthly_base_salary / s.monthly_target_orders),
            bonusPerExtraOrder: s.bonus_per_extra_order,
            deductionPerMissingOrder: s.deduction_per_missing_order,
          }
        }
      } catch {}
      const payrollMonth = results[0]?.payrollMonth || 'Payroll'
      exportDriversToExcel({ results, payrollMonth, ruleSummary, companyName: 'Nokhaba Tatweer for Trading' })
    } catch (e: any) {
      console.error('Excel export failed:', e)
      alert('Excel export failed: ' + (e.message || ''))
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!runId) {
      // Get latest runId
      fetch('/api/dashboard').then(r => r.json()).then(d => {
        if (d?.run?.id) setRunId(d.run.id)
      })
      return
    }
    queueMicrotask(() => setLoading(true))
    const params = new URLSearchParams({ runId, search, sort })
    if (band !== 'all') params.set('band', band)
    if (review !== 'all') params.set('review', review)
    fetch(`/api/drivers?${params.toString()}`)
      .then(r => r.json())
      .then(d => setResults(d?.results ?? []))
      .finally(() => setLoading(false))
  }, [runId, search, sort, band, review])

  const stats = useMemo(() => {
    const total = results.length
    const flagged = results.filter(r => r.reviewStatus !== 'ok').length
    const totalNet = results.reduce((a, r) => a + r.finalNetSalary, 0)
    const avgNet = total > 0 ? totalNet / total : 0
    return { total, flagged, totalNet, avgNet }
  }, [results])

  const openPayslip = (r: any) => {
    setSelectedResult(r)
    setPayslipOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Driver Results</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} drivers · {stats.flagged} flagged · Avg net SAR {stats.avgNet.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || results.length === 0}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
          >
            {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('payslips')}>
            <FileText className="mr-1 h-4 w-4" /> Bulk Payslips
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-glow">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, rider ID, or contract..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={band} onValueChange={setBand}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Performance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bands</SelectItem>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={review} onValueChange={setReview}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Review status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ok">OK Only</SelectItem>
              <SelectItem value="review">Needs Review</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="mr-1 h-3 w-3" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net_desc">Net: High → Low</SelectItem>
              <SelectItem value="net_asc">Net: Low → High</SelectItem>
              <SelectItem value="orders_desc">Orders: High → Low</SelectItem>
              <SelectItem value="orders_asc">Orders: Low → High</SelectItem>
              <SelectItem value="penalty_desc">Penalties: High → Low</SelectItem>
              <SelectItem value="name_asc">Name: A → Z</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card className="card-glow">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Driver</th>
                  <th className="py-3 px-4 font-medium text-right">Orders</th>
                  <th className="py-3 px-4 font-medium text-right">Target</th>
                  <th className="py-3 px-4 font-medium text-right">Days</th>
                  <th className="py-3 px-4 font-medium text-right">Gross (SAR)</th>
                  <th className="py-3 px-4 font-medium text-right">Segment (SAR)</th>
                  <th className="py-3 px-4 font-medium text-right">Penalties (SAR)</th>
                  <th className="py-3 px-4 font-medium text-right">Traffic (SAR)</th>
                  <th className="py-3 px-4 font-medium text-right">Net (SAR)</th>
                  <th className="py-3 px-4 font-medium text-center">Band</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                  <th className="py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={12} className="py-12 text-center text-muted-foreground">No drivers found</td></tr>
                ) : results.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium">{r.driverName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.riderId}</div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {r.completedOrders}
                      {r.extraOrders > 0 && (
                        <span className="ml-1 text-[10px] text-emerald-600">+{r.extraOrders}</span>
                      )}
                      {r.missingOrders > 0 && (
                        <span className="ml-1 text-[10px] text-rose-600">-{r.missingOrders}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{r.selectedTargetThreshold.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{r.actualWorkingDays.toFixed(0)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{r.grossSalaryBeforePenalties.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-cyan-600">{(r.segmentPayment || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-rose-600">{r.totalOtherPenalties.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-600">{r.trafficViolationsDeduction.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-600">{r.finalNetSalary.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        BAND_COLORS[r.performanceBand]
                      )}>
                        {BAND_LABELS[r.performanceBand]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.reviewStatus === 'ok' ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                      ) : (
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          r.reviewStatus === 'flagged' ? 'status-major' : 'status-minor'
                        )}>
                          <AlertTriangle className="h-3 w-3" />
                          {r.reviewStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openPayslip(r)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {results.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="py-3 px-4">Total ({results.length})</td>
                    <td className="py-3 px-4 text-right tabular-nums">{results.reduce((a, r) => a + r.completedOrders, 0)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{results.reduce((a, r) => a + r.selectedTargetThreshold, 0).toFixed(0)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{results.reduce((a, r) => a + r.actualWorkingDays, 0).toFixed(0)}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{results.reduce((a, r) => a + r.grossSalaryBeforePenalties, 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-cyan-600">{results.reduce((a, r) => a + (r.segmentPayment || 0), 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-rose-600">{results.reduce((a, r) => a + r.totalOtherPenalties, 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-600">{results.reduce((a, r) => a + r.trafficViolationsDeduction, 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-600">{results.reduce((a, r) => a + r.finalNetSalary, 0).toFixed(2)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payslip dialog */}
      <Dialog open={payslipOpen} onOpenChange={setPayslipOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Payslip Preview</DialogTitle>
          </DialogHeader>
          {selectedResult && <PayslipPreview resultId={selectedResult.id} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
