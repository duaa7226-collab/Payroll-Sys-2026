'use client'

import { useEffect, useState } from 'react'
import {
  Plus, Search, Trash2, Pencil, PlusCircle, MinusCircle,
  BadgeCheck, X, FileText
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { safeFetchJson } from '@/lib/safe-fetch'
import { toast } from 'sonner'

const PRESET_TYPES = [
  { title: 'License Issuing Payment', titleAr: 'رسوم إصدار الرخصة', type: 'deduction', category: 'license' },
  { title: 'Performance Reward', titleAr: 'مكافأة تميز', type: 'bonus', category: 'custom_bonus' },
  { title: 'Equipment Allowance', titleAr: 'بدل معدات', type: 'bonus', category: 'custom_bonus' },
  { title: 'Custom Bonus', titleAr: '', type: 'bonus', category: 'custom_bonus' },
  { title: 'Custom Deduction', titleAr: '', type: 'deduction', category: 'custom_deduction' },
]

const TYPE_COLORS: Record<string, string> = {
  bonus: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  deduction: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  license: 'License',
  custom_bonus: 'Custom Bonus',
  custom_deduction: 'Custom Deduction',
}

export function ManualAdjustmentsView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [drivers, setDrivers] = useState<any[]>([])

  const reload = () => {
    queueMicrotask(() => setLoading(true))
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    safeFetchJson(`/api/manual-adjustments?${params.toString()}`, { adjustments: [] })
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [typeFilter])

  useEffect(() => {
    safeFetchJson('/api/dashboard', null).then(d => {
      if (d?.run?.id) {
        safeFetchJson(`/api/drivers?runId=${d.run.id}`, { results: [] })
          .then(dr => setDrivers(dr?.results ?? []))
      }
    })
  }, [])

  const openCreate = () => { setEditing(null); setEditOpen(true) }
  const openEdit = (a: any) => { setEditing(a); setEditOpen(true) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this adjustment?')) return
    const resp = await fetch(`/api/manual-adjustments?id=${id}`, { method: 'DELETE' })
    if (resp.ok) {
      toast.success('Deleted — recalculating payroll...')
      reload()
      // Trigger immediate recalculation
      safeFetchJson('/api/dashboard', null).then(d => {
        if (d?.run?.id) {
          fetch(`/api/recalculate?runId=${d.run.id}`, { method: 'POST' })
            .then(() => toast.success('Payroll recalculated'))
            .catch(() => toast.error('Recalculation failed'))
        }
      })
    }
    else toast.error('Delete failed')
  }

  const filtered = (data?.adjustments ?? []).filter((a: any) =>
    a.riderId.toLowerCase().includes(search.toLowerCase()) ||
    a.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Manual Adjustments</h1>
          <p className="text-sm text-muted-foreground">
            Add License Issuing Payments, custom bonuses & deductions · appears on payslips
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Adjustment
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Adjustments</div>
            <div className="mt-1 text-2xl font-bold">{data?.count ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="card-glow border-emerald-200 dark:border-emerald-900/40">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <PlusCircle className="h-3 w-3" /> Total Bonuses
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">SAR {data?.totalBonus?.toFixed(2) ?? '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="card-glow border-rose-200 dark:border-rose-900/40">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MinusCircle className="h-3 w-3" /> Total Deductions
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">SAR {data?.totalDeduction?.toFixed(2) ?? '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Drivers Affected</div>
            <div className="mt-1 text-2xl font-bold">{data?.byDriver?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 p-3 text-xs text-violet-800 dark:text-violet-300">
        <FileText className="inline h-3.5 w-3.5 mr-1.5" />
        <strong>How it works:</strong> Bonuses are added to the rider's gross salary. Deductions (like License Issuing Payment) are subtracted from the net salary. All adjustments appear on the payslip automatically when the Excel is uploaded.
      </div>

      {/* Filters */}
      <Card className="card-glow">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by rider ID or title..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bonus">Bonuses</SelectItem>
              <SelectItem value="deduction">Deductions</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="card-glow">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Rider ID</th>
                  <th className="py-3 px-4 font-medium">Title</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium text-right">Amount (SAR)</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <FileText className="mx-auto h-10 w-10 opacity-40 mb-2" />
                    No adjustments found
                  </td></tr>
                ) : filtered.map((a: any) => (
                  <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs">{a.riderId}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{a.title}</div>
                      {a.titleAr && <div className="text-xs text-muted-foreground" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{a.titleAr}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[a.type] ?? ''}`}>
                        {a.type === 'bonus' ? <PlusCircle className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                        {a.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{CATEGORY_LABELS[a.category] || a.category}</td>
                    <td className={`py-3 px-4 text-right tabular-nums font-semibold ${a.type === 'bonus' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {a.type === 'bonus' ? '+' : '-'}{a.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${a.status === 'active' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EditDialog open={editOpen} onOpenChange={setEditOpen} adjustment={editing} drivers={drivers} onSaved={reload} />
    </div>
  )
}

function EditDialog({ open, onOpenChange, adjustment, drivers, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; adjustment: any | null; drivers: any[]; onSaved: () => void
}) {
  const [riderId, setRiderId] = useState('')
  const [title, setTitle] = useState('')
  const [titleAr, setTitleAr] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('deduction')
  const [category, setCategory] = useState('license')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (adjustment) {
      setRiderId(adjustment.riderId)
      setTitle(adjustment.title)
      setTitleAr(adjustment.titleAr || '')
      setAmount(String(adjustment.amount))
      setType(adjustment.type)
      setCategory(adjustment.category)
      setNotes(adjustment.notes || '')
    } else {
      setRiderId(drivers[0]?.riderId ?? '')
      setTitle('License Issuing Payment')
      setTitleAr('رسوم إصدار الرخصة')
      setAmount('')
      setType('deduction')
      setCategory('license')
      setNotes('')
    }
  }, [adjustment, drivers, open])

  const applyPreset = (preset: any) => {
    setTitle(preset.title)
    setTitleAr(preset.titleAr)
    setType(preset.type)
    setCategory(preset.category)
  }

  const handleSave = async () => {
    if (!riderId || !title || !amount) { toast.error('Rider, title, and amount required'); return }
    setSaving(true)
    try {
      const body = { riderId, title, titleAr, amount: parseFloat(amount), type, category, notes }
      let resp
      if (adjustment) {
        resp = await fetch('/api/manual-adjustments', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: adjustment.id, ...body }) })
      } else {
        resp = await fetch('/api/manual-adjustments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      if (resp.ok) {
        toast.success(adjustment ? 'Updated — recalculating...' : 'Created — recalculating...')
        onOpenChange(false)
        onSaved()
        // Trigger immediate recalculation
        safeFetchJson('/api/dashboard', null).then(d => {
          if (d?.run?.id) {
            fetch(`/api/recalculate?runId=${d.run.id}`, { method: 'POST' })
              .then(() => toast.success('Payroll recalculated'))
              .catch(() => toast.error('Recalculation failed'))
          }
        })
      }
      else { const err = await resp.json().catch(() => ({})); toast.error(err.error || 'Save failed') }
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{adjustment ? 'Edit Adjustment' : 'Add Manual Adjustment'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto">
          {/* Preset buttons */}
          {!adjustment && (
            <div>
              <Label className="text-xs">Quick Presets</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PRESET_TYPES.map((p, i) => (
                  <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => applyPreset(p)}>
                    {p.type === 'bonus' ? <PlusCircle className="mr-1 h-3 w-3 text-emerald-500" /> : <MinusCircle className="mr-1 h-3 w-3 text-rose-500" />}
                    {p.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">Driver / Rider ID</Label>
            <Select value={riderId} onValueChange={setRiderId}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                {drivers.map((d: any) => (<SelectItem key={d.riderId} value={d.riderId}>{d.driverName} ({d.riderId})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Title (English)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. License Issuing Payment" />
            </div>
            <div>
              <Label className="text-xs">Title (Arabic) — optional</Label>
              <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="رسوم إصدار الرخصة" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount (SAR)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" placeholder="e.g. 200" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deduction">Deduction (subtract from salary)</SelectItem>
                  <SelectItem value="bonus">Bonus (add to salary)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="license">License Issuing Payment</SelectItem>
                <SelectItem value="custom_bonus">Custom Bonus</SelectItem>
                <SelectItem value="custom_deduction">Custom Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes — optional</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" />
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
