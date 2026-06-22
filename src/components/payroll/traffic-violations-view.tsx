'use client'

import { useEffect, useState } from 'react'
import {
  CarFront, Plus, Search, Trash2, Pencil, AlertCircle,
  CheckCircle2, X, Download
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  rejected: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  paid: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
}

export function TrafficViolationsView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [drivers, setDrivers] = useState<any[]>([])

  const reload = () => {
    queueMicrotask(() => setLoading(true))
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    fetch(`/api/traffic-violations?${params.toString()}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [statusFilter])

  useEffect(() => {
    fetch('/api/drivers?runId=').catch(() => {})
    // Load drivers list from any payroll run
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d?.run?.id) {
          fetch(`/api/drivers?runId=${d.run.id}`)
            .then(r => r.json())
            .then(dr => setDrivers(dr?.results ?? []))
        }
      })
  }, [])

  const openCreate = () => {
    setEditing(null)
    setEditOpen(true)
  }

  const openEdit = (v: any) => {
    setEditing(v)
    setEditOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this violation?')) return
    const resp = await fetch(`/api/traffic-violations?id=${id}`, { method: 'DELETE' })
    if (resp.ok) {
      toast.success('Violation deleted')
      reload()
    } else {
      toast.error('Delete failed')
    }
  }

  const filtered = (data?.violations ?? []).filter((v: any) =>
    v.riderId.toLowerCase().includes(search.toLowerCase()) ||
    v.violationType.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Traffic Violations</h1>
          <p className="text-sm text-muted-foreground">
            Manage traffic tickets as payroll deductions · appears on payslips
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Violation
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Violations</div>
            <div className="mt-1 text-2xl font-bold">{data?.violations?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Amount</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">SAR {data?.total?.toFixed(2) ?? '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approved (Deductible)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">SAR {data?.approved?.toFixed(2) ?? '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Drivers Affected</div>
            <div className="mt-1 text-2xl font-bold">{data?.byDriver?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-glow">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by rider ID or violation type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Violations table */}
      <Card className="card-glow">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Rider ID</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Notes</th>
                  <th className="py-3 px-4 font-medium text-right">Amount (SAR)</th>
                  <th className="py-3 px-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CarFront className="mx-auto h-10 w-10 opacity-40 mb-2" />
                    No violations found
                  </td></tr>
                ) : filtered.map((v: any) => (
                  <tr key={v.id} className="border-t border-border/60 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-sm">{new Date(v.ticketDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-3 px-4 font-mono text-xs">{v.riderId}</td>
                    <td className="py-3 px-4">{v.violationType}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[v.status] ?? ''}`}>
                        {v.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {v.status === 'rejected' && <X className="h-3 w-3" />}
                        {v.status === 'pending' && <AlertCircle className="h-3 w-3" />}
                        {v.status === 'paid' && <CheckCircle2 className="h-3 w-3" />}
                        {v.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{v.notes}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold">{v.amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(v.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create dialog */}
      <EditViolationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        violation={editing}
        drivers={drivers}
        onSaved={reload}
      />
    </div>
  )
}

function EditViolationDialog({ open, onOpenChange, violation, drivers, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  violation: any | null
  drivers: any[]
  onSaved: () => void
}) {
  const [riderId, setRiderId] = useState('')
  const [violationType, setViolationType] = useState('')
  const [amount, setAmount] = useState('')
  const [ticketDate, setTicketDate] = useState('')
  const [ticketNumber, setTicketNumber] = useState('')
  const [status, setStatus] = useState('approved')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (violation) {
      setRiderId(violation.riderId)
      setViolationType(violation.violationType)
      setAmount(String(violation.amount))
      setTicketDate(new Date(violation.ticketDate).toISOString().slice(0, 10))
      setTicketNumber(violation.ticketNumber || '')
      setStatus(violation.status)
      setNotes(violation.notes || '')
    } else {
      setRiderId(drivers[0]?.riderId ?? '')
      setViolationType('')
      setAmount('')
      setTicketDate(new Date().toISOString().slice(0, 10))
      setTicketNumber('')
      setStatus('approved')
      setNotes('')
    }
  }, [violation, drivers, open])

  const handleSave = async () => {
    if (!riderId || !violationType || !amount) {
      toast.error('Rider, type, and amount are required')
      return
    }
    setSaving(true)
    try {
      const body = { riderId, violationType, amount: parseFloat(amount), ticketDate, ticketNumber, status, notes }
      let resp
      if (violation) {
        resp = await fetch('/api/traffic-violations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: violation.id, ...body }),
        })
      } else {
        resp = await fetch('/api/traffic-violations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (resp.ok) {
        toast.success(violation ? 'Updated' : 'Created')
        onOpenChange(false)
        onSaved()
      } else {
        const err = await resp.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{violation ? 'Edit Violation' : 'Add Traffic Violation'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Driver / Rider ID</Label>
            <Select value={riderId} onValueChange={setRiderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d: any) => (
                  <SelectItem key={d.riderId} value={d.riderId}>
                    {d.driverName} ({d.riderId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Violation Type</Label>
              <Input value={violationType} onChange={(e) => setViolationType(e.target.value)} placeholder="e.g. Speeding" />
            </div>
            <div>
              <Label className="text-xs">Amount (SAR)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ticket Date</Label>
              <Input type="date" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ticket Number</Label>
              <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved (deductible)</SelectItem>
                <SelectItem value="pending">Pending review</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Already paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
