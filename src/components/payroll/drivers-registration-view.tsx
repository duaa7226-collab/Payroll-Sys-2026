'use client'

import { useEffect, useState } from 'react'
import {
  Users, Plus, Search, Trash2, Pencil, CarFront, Building2, CreditCard, User, IdCard
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function DriversRegistrationView() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const reload = () => {
    queueMicrotask(() => setLoading(true))
    fetch('/api/drivers?all=1')
      .then(async r => {
        const text = await r.text()
        if (!text) return { results: [] }
        try { return JSON.parse(text) } catch { return { results: [] } }
      })
      .then(d => setDrivers(d?.results ?? []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const openCreate = () => { setEditing(null); setEditOpen(true) }
  const openEdit = (d: any) => { setEditing(d); setEditOpen(true) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this driver? This will also remove all their results, violations, and adjustments.')) return
    const resp = await fetch(`/api/drivers?id=${id}`, { method: 'DELETE' })
    if (resp.ok) {
      toast.success('Driver deleted')
      reload()
    } else {
      const err = await resp.json().catch(() => ({}))
      toast.error(err.error || 'Delete failed')
    }
  }

  const filtered = drivers.filter(d =>
    (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.riderId || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.contractName || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.bankName || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.iban || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Drivers Registration</h1>
          <p className="text-sm text-muted-foreground">
            Register drivers with name, rider ID, and banking info · appears in dropdowns across the system
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Driver
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Drivers</div>
            <div className="mt-1 text-2xl font-bold">{drivers.length}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">With Bank Info</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{drivers.filter(d => d.bankName && d.iban).length}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Missing Bank Info</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{drivers.filter(d => !d.bankName || !d.iban).length}</div>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contracts</div>
            <div className="mt-1 text-2xl font-bold">{new Set(drivers.map(d => d.contractName)).size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="card-glow">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, rider ID, contract, bank, or IBAN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Drivers grid */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="card-glow">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 opacity-40 mb-2" />
            {drivers.length === 0 ? 'No drivers registered yet. Click "Add Driver" to register your first driver.' : 'No drivers match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id} className="card-glow hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{d.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{d.riderId}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
                {/* Info grid */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Contract:</span>
                    <span className="font-medium truncate">{d.contractName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CarFront className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-medium">{d.vehicleType || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-medium">{d.bankName || <span className="text-amber-600">Not set</span>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IdCard className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">IBAN:</span>
                    <span className="font-mono text-[10px]">{d.iban || <span className="text-amber-600">Not set</span>}</span>
                  </div>
                  {d.beneficiaryName && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Beneficiary:</span>
                      <span className="font-medium truncate" dir="auto">{d.beneficiaryName}</span>
                    </div>
                  )}
                </div>
                {/* Badges */}
                <div className="flex flex-wrap gap-1 pt-2 border-t border-border/60">
                  {d.bankName && d.iban ? (
                    <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-500/40 bg-emerald-500/10">
                      Banking Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-500/40 bg-amber-500/10">
                      Banking Incomplete
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create dialog */}
      <EditDriverDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        driver={editing}
        onSaved={reload}
      />
    </div>
  )
}

function EditDriverDialog({ open, onOpenChange, driver, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  driver: any | null
  onSaved: () => void
}) {
  const [riderId, setRiderId] = useState('')
  const [name, setName] = useState('')
  const [contractName, setContractName] = useState('nokhaba_tatweer_ftr')
  const [vehicleType, setVehicleType] = useState('car')
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (driver) {
      setRiderId(driver.riderId)
      setName(driver.name)
      setContractName(driver.contractName || 'nokhaba_tatweer_ftr')
      setVehicleType(driver.vehicleType || 'car')
      setBankName(driver.bankName || '')
      setIban(driver.iban || '')
      setBeneficiaryName(driver.beneficiaryName || '')
    } else {
      setRiderId('')
      setName('')
      setContractName('nokhaba_tatweer_ftr')
      setVehicleType('car')
      setBankName('')
      setIban('')
      setBeneficiaryName('')
    }
  }, [driver, open])

  const handleSave = async () => {
    if (!riderId || !name) {
      toast.error('Rider ID and Name are required')
      return
    }
    setSaving(true)
    try {
      const body = {
        riderId: riderId.trim(),
        name: name.trim(),
        contractName: contractName.trim() || 'nokhaba_tatweer_ftr',
        vehicleType: vehicleType.trim() || 'car',
        bankName: bankName.trim(),
        iban: iban.trim(),
        beneficiaryName: beneficiaryName.trim(),
      }
      let resp
      if (driver) {
        resp = await fetch('/api/drivers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: driver.id, ...body }),
        })
      } else {
        resp = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (resp.ok) {
        toast.success(driver ? 'Driver updated' : 'Driver added')
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
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{driver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
          <DialogDescription>
            Register driver info so it appears in dropdowns across the system (traffic violations, bonuses, adjustments).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Driver Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Islam" />
            </div>
            <div>
              <Label className="text-xs">Rider ID *</Label>
              <Input value={riderId} onChange={(e) => setRiderId(e.target.value)} placeholder="e.g. 4643856" className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contract Name</Label>
              <Input value={contractName} onChange={(e) => setContractName(e.target.value)} placeholder="nokhaba_tatweer_ftr" />
            </div>
            <div>
              <Label className="text-xs">Vehicle Type</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Banking info section */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 text-[11px] font-medium">
              <CreditCard className="h-3.5 w-3.5" /> Banking Information
            </div>
            <div>
              <Label className="text-xs">Beneficiary Name</Label>
              <Input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} placeholder="e.g. Nokhaba Tatweer for Trading" dir="auto" />
            </div>
            <div>
              <Label className="text-xs">Bank Name</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Al Rajhi Bank" />
            </div>
            <div>
              <Label className="text-xs">IBAN</Label>
              <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="e.g. SA1980000495608016363188" className="font-mono" />
            </div>
            <div className="text-[9px] text-muted-foreground italic">
              ℹ️ Banking info appears on the driver's payslip and is used for salary disbursement.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (driver ? 'Update' : 'Add Driver')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
