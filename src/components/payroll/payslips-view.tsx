'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, Search, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { generatePayslipPDF } from '@/lib/payslip-pdf'
import { toast } from 'sonner'

export function PayslipsView({ runId }: { runId: string | null }) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const [open, setOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    if (!runId) return
    setLoading(true)
    fetch(`/api/drivers?runId=${runId}`)
      .then(r => r.json())
      .then(d => setResults(d?.results ?? []))
      .finally(() => setLoading(false))
  }, [runId])

  const filtered = results.filter(r =>
    r.driverName.toLowerCase().includes(search.toLowerCase()) ||
    r.riderId.toLowerCase().includes(search.toLowerCase())
  )

  const handleBulkDownload = async () => {
    setBulkLoading(true)
    try {
      // Sequential download — fire them one by one with brief delay
      toast.info(`Generating ${filtered.length} PDFs...`)
      for (const r of filtered) {
        const resp = await fetch(`/api/payslip?resultId=${r.id}`)
        const data = await resp.json()
        generatePayslipPDF(data)
        await new Promise(res => setTimeout(res, 250))
      }
      toast.success(`Generated ${filtered.length} payslips`)
    } catch (e) {
      toast.error('Bulk export failed')
    } finally {
      setBulkLoading(false)
    }
  }

  const openPayslip = (r: any) => {
    setSelectedResult(r)
    setOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Payslips</h1>
          <p className="text-sm text-muted-foreground">
            Preview, print, or download individual & bulk PDF payslips
          </p>
        </div>
        <Button onClick={handleBulkDownload} disabled={bulkLoading || filtered.length === 0}>
          <Download className="mr-1 h-4 w-4" />
          {bulkLoading ? 'Generating...' : `Bulk Export ${filtered.length} PDFs`}
        </Button>
      </div>

      <Card className="card-glow">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center text-muted-foreground py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12">No payslips found</div>
        ) : filtered.map(r => (
          <Card key={r.id} className="card-glow cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={() => openPayslip(r)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {r.performanceBand}
                </Badge>
              </div>
              <div className="mt-3">
                <div className="font-semibold">{r.driverName}</div>
                <div className="text-xs text-muted-foreground font-mono">{r.riderId}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Net Salary</div>
                  <div className="font-bold text-emerald-600 tabular-nums">SAR {r.finalNetSalary.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Orders</div>
                  <div className="font-semibold tabular-nums">{r.completedOrders}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                <FileText className="mr-1 h-3 w-3" /> View Payslip
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
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
