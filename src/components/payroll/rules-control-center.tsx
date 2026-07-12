'use client'

import { useEffect, useState } from 'react'
import {
  Settings2, Save, RefreshCw, Check, AlertTriangle, RotateCcw,
  ChevronDown, ChevronRight, FileText, History, Info, Beaker, Layers,
  Plus, Trash2, Gift, Loader2, MinusCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion'
import { toast } from 'sonner'
import { safeFetchJson } from '@/lib/safe-fetch'
import { cn } from '@/lib/utils'

const GROUP_LABELS: Record<string, { en: string; ar: string; desc: string }> = {
  salary_base: { en: 'Salary Base Rules', ar: 'أساس الراتب', desc: 'Core salary parameters' },
  calculation_mode: { en: 'Calculation Mode', ar: 'وضع الحساب', desc: 'Salary strategy selection' },
  orders_performance: { en: 'Orders Performance', ar: 'أداء الطلبات', desc: 'Bonus & deduction for orders' },
  working_days: { en: 'Working Days', ar: 'أيام العمل', desc: 'Attendance source & proration' },
  penalties: { en: 'Penalty Rules', ar: 'قواعد الغرامات', desc: 'Enable/disable each penalty type' },
  variance: { en: 'Variance & Control', ar: 'المقارنة والتحكم', desc: 'Control totals & tolerances' },
  output: { en: 'Output Rules', ar: 'قواعد الإخراج', desc: 'Payslip & display preferences' },
  import: { en: 'Import Rules', ar: 'قواعد الاستيراد', desc: 'Workbook template rules' },
}

export function RulesControlCenter() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [values, setValues] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch('/api/rules?active=true')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setValues({ ...d.snapshot })
      })
      .finally(() => setLoading(false))
  }, [])

  const updateValue = (key: string, val: any) => {
    setValues(v => ({ ...v, [key]: val }))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!data?.ruleSetId) return
    setSaving(true)
    try {
      // Send only changed values (simpler: send all)
      const updates: Record<string, any> = {}
      for (const def of (data.definitions as any[])) {
        if (values[def.key] !== data.snapshot[def.key]) {
          updates[def.key] = values[def.key]
        }
      }
      if (Object.keys(updates).length === 0) {
        toast.info('No changes to save')
        setDirty(false)
        return
      }
      const resp = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleSetId: data.ruleSetId, updates }),
      })
      if (resp.ok) {
        toast.success(`Saved ${Object.keys(updates).length} rule changes`)
        setDirty(false)
        // Refresh snapshot
        setData((d: any) => ({ ...d, snapshot: { ...values } }))
      } else {
        toast.error('Save failed')
      }
    } catch (e) {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setValues({ ...data.snapshot })
    setDirty(false)
    toast.info('Reverted to last saved state')
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 shimmer rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 shimmer rounded-xl" />)}
        </div>
      </div>
    )
  }

  const groups = (data.definitions as any[]).reduce((acc: any, def: any) => {
    if (!acc[def.group]) acc[def.group] = []
    acc[def.group].push(def)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Rules Control Center</h1>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15">
              <Check className="mr-1 h-3 w-3" /> Active
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.ruleSetName} · Centralized source of truth for all payroll calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Revert
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* Active Rule Banner */}
      <Card className="card-glow border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-950/20">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Layers className="h-4 w-4 text-emerald-600" />
            {data.ruleSetName}
          </div>
          <Meta label="Mode" value={values.salary_mode === 'orders_based_mode' ? 'Orders-Based' : 'Days-Prorated'} />
          <Meta label="Currency" value={values.currency} />
          <Meta label="Updated" value={new Date(data.ruleSet.updatedAt).toLocaleString()} />
          <Meta label="Activated by" value={data.ruleSet.activatedBy || 'system'} />
          <Badge variant="outline" className="ml-auto text-[10px]">
            <History className="mr-1 h-3 w-3" />
            v{data.ruleSet.id.slice(-6)}
          </Badge>
        </CardContent>
      </Card>

      {/* Active Mode Quick Reference */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickRef label="Monthly Base" value={`SAR ${values.monthly_base_salary}`} />
        <QuickRef label="Std Working Days" value={`${values.standard_working_days} days`} />
        <QuickRef label="Monthly Target" value={`${values.monthly_target_orders} orders`} />
        <QuickRef label="Per Order Rate" value={`SAR ${(values.monthly_base_salary / values.monthly_target_orders).toFixed(4)}`} />
      </div>

      {/* Rule Groups (accordion) */}
      <Accordion type="multiple" defaultValue={['salary_base', 'calculation_mode']} className="space-y-3">
        {Object.entries(groups).map(([groupId, defs]: any) => {
          const info = GROUP_LABELS[groupId] ?? { en: groupId, ar: '', desc: '' }
          return (
            <AccordionItem key={groupId} value={groupId} className="border-0">
              <Card className="card-glow">
                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Settings2 className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold">{info.en}</div>
                      <div className="text-xs text-muted-foreground">{info.desc}</div>
                    </div>
                    <Badge variant="outline" className="ml-2 text-[10px]">{(defs as any[]).length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(defs as any[]).map(def => (
                      <RuleEditor
                        key={def.key}
                        def={def}
                        value={values[def.key]}
                        onChange={(v) => updateValue(def.key, v)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Custom Bonuses Section */}
      <CustomBonusesSection />
      <CustomDeductionsSection />

      {/* Audit log teaser */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4" /> Recent Rule Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditPreview />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Custom Bonuses Management Section
// ============================================================
function CustomBonusesSection() {
  const [bonuses, setBonuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameAr, setNewNameAr] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setLoading(true)
    safeFetchJson('/api/custom-bonuses', { bonuses: [] })
      .then(d => setBonuses(d?.bonuses ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const triggerRecalc = () => {
    safeFetchJson('/api/dashboard', null).then(d => {
      if (d?.run?.id) {
        fetch(`/api/recalculate?runId=${d.run.id}`, { method: 'POST' })
          .then(() => toast.success('Payroll recalculated with new bonuses'))
          .catch(() => toast.error('Recalculation failed'))
      }
    })
  }

  const handleAdd = async () => {
    if (!newName || !newAmount) { toast.error('Name and amount required'); return }
    setSaving(true)
    try {
      const resp = await fetch('/api/custom-bonuses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, nameAr: newNameAr, amount: parseFloat(newAmount), type: 'fixed' }),
      })
      if (resp.ok) {
        toast.success(`Bonus "${newName}" added — recalculating...`)
        setNewName(''); setNewNameAr(''); setNewAmount(''); setAdding(false)
        reload()
        triggerRecalc()
      } else { toast.error('Add failed') }
    } finally { setSaving(false) }
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await fetch('/api/custom-bonuses', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    toast.success(`Bonus ${newStatus === 'active' ? 'activated' : 'deactivated'} — recalculating...`)
    reload()
    triggerRecalc()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bonus?')) return
    await fetch(`/api/custom-bonuses?id=${id}`, { method: 'DELETE' })
    toast.success('Deleted — recalculating...')
    reload()
    triggerRecalc()
  }

  const activeTotal = bonuses.filter(b => b.status === 'active').reduce((a, b) => a + b.amount, 0)

  return (
    <Card className="card-glow border-amber-200 dark:border-amber-900/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-amber-500" />
            Custom Bonuses
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {bonuses.filter(b => b.status === 'active').length} active · SAR {activeTotal.toFixed(2)}/rider
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
              <Plus className="h-3.5 w-3.5" /> Add Bonus
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Define custom bonuses that apply to ALL riders automatically · added to gross salary · takes effect immediately
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new form */}
        {adding && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Bonus Name (English)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Mecca Hajj Bonus" className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Bonus Name (Arabic)</Label>
                <Input value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} placeholder="مكافأة حج مكة" className="h-8" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[10px]">Amount per Rider (SAR)</Label>
                <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="e.g. 500" className="h-8" step="0.01" />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add & Apply
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-300">
              ℹ️ This bonus will be added to every rider's gross salary immediately. All payslips and results update automatically.
            </p>
          </div>
        )}

        {/* Existing bonuses list */}
        {loading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Loading...</div>
        ) : bonuses.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">
            <Gift className="mx-auto h-8 w-8 opacity-40 mb-1" />
            No custom bonuses defined yet
          </div>
        ) : (
          <div className="space-y-2">
            {bonuses.map(b => (
              <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Gift className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{b.name}</div>
                  {b.nameAr && <div className="text-xs text-muted-foreground" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{b.nameAr}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums text-emerald-600">+SAR {b.amount.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">per rider</div>
                </div>
                <Badge variant="outline" className={cn('text-[9px]', b.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                  {b.status}
                </Badge>
                <Switch checked={b.status === 'active'} onCheckedChange={() => handleToggle(b.id, b.status)} />
                <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            ))}
            {activeTotal > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2 text-xs text-emerald-700 dark:text-emerald-300 text-center">
                Total active custom bonuses: <strong>SAR {activeTotal.toFixed(2)}</strong> per rider · applies to all payslips automatically
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Custom Deductions Management Section
// ============================================================
function CustomDeductionsSection() {
  const [deductions, setDeductions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameAr, setNewNameAr] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setLoading(true)
    safeFetchJson('/api/custom-deductions', { deductions: [] })
      .then(d => setDeductions(d?.deductions ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [])

  const triggerRecalc = () => {
    safeFetchJson('/api/dashboard', null).then(d => {
      if (d?.run?.id) {
        fetch(`/api/recalculate?runId=${d.run.id}`, { method: 'POST' })
          .then(() => toast.success('Payroll recalculated with new deductions'))
          .catch(() => toast.error('Recalculation failed'))
      }
    })
  }

  const handleAdd = async () => {
    if (!newName || !newAmount) { toast.error('Name and amount required'); return }
    setSaving(true)
    try {
      const resp = await fetch('/api/custom-deductions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, nameAr: newNameAr, amount: parseFloat(newAmount) }),
      })
      if (resp.ok) {
        toast.success(`Deduction "${newName}" added — recalculating...`)
        setNewName(''); setNewNameAr(''); setNewAmount(''); setAdding(false)
        reload()
        triggerRecalc()
      } else { toast.error('Add failed') }
    } finally { setSaving(false) }
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await fetch('/api/custom-deductions', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    toast.success(`Deduction ${newStatus === 'active' ? 'activated' : 'deactivated'} — recalculating...`)
    reload()
    triggerRecalc()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deduction?')) return
    await fetch(`/api/custom-deductions?id=${id}`, { method: 'DELETE' })
    toast.success('Deleted — recalculating...')
    reload()
    triggerRecalc()
  }

  const activeTotal = deductions.filter(d => d.status === 'active').reduce((a, d) => a + d.amount, 0)

  return (
    <Card className="card-glow border-rose-200 dark:border-rose-900/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <MinusCircle className="h-4 w-4 text-rose-500" />
            Custom Deductions
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {deductions.filter(d => d.status === 'active').length} active · SAR {activeTotal.toFixed(2)}/rider
            </Badge>
            <Button size="sm" variant="outline" onClick={() => setAdding(!adding)}>
              <Plus className="h-3.5 w-3.5" /> Add Deduction
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Define custom deductions that apply to ALL riders automatically · subtracted from net salary · takes effect immediately
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Deduction Name (English)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Insurance Premium" className="h-8" />
              </div>
              <div>
                <Label className="text-[10px]">Deduction Name (Arabic)</Label>
                <Input value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} placeholder="قسط التأمين" className="h-8" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[10px]">Amount per Rider (SAR)</Label>
                <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="e.g. 150" className="h-8" step="0.01" />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add & Apply
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-rose-700 dark:text-rose-300">
              ℹ️ This deduction will be subtracted from every rider's net salary immediately. All payslips and results update automatically.
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">Loading...</div>
        ) : deductions.length === 0 ? (
          <div className="text-center text-muted-foreground py-4 text-sm">
            <MinusCircle className="mx-auto h-8 w-8 opacity-40 mb-1" />
            No custom deductions defined yet
          </div>
        ) : (
          <div className="space-y-2">
            {deductions.map(d => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
                  <MinusCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{d.name}</div>
                  {d.nameAr && <div className="text-xs text-muted-foreground" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>{d.nameAr}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums text-rose-600">-SAR {d.amount.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">per rider</div>
                </div>
                <Badge variant="outline" className={cn('text-[9px]', d.status === 'active' ? 'bg-rose-500/10 text-rose-700' : 'bg-muted text-muted-foreground')}>
                  {d.status}
                </Badge>
                <Switch checked={d.status === 'active'} onCheckedChange={() => handleToggle(d.id, d.status)} />
                <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            ))}
            {activeTotal > 0 && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 p-2 text-xs text-rose-700 dark:text-rose-300 text-center">
                Total active custom deductions: <strong>SAR {activeTotal.toFixed(2)}</strong> per rider · subtracted from all payslips automatically
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function QuickRef({ label, value }: { label: string; value: string }) {
  return (
    <Card className="card-glow">
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function RuleEditor({ def, value, onChange }: { def: any; value: any; onChange: (v: any) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Label className="text-xs font-semibold">{def.label}</Label>
          <div className="text-[10px] text-muted-foreground/80" dir="rtl" style={{ fontFamily: 'var(--font-arabic)' }}>
            {def.labelAr}
          </div>
        </div>
        {def.unit && (
          <Badge variant="outline" className="text-[9px] font-mono">{def.unit}</Badge>
        )}
      </div>
      {def.helpText && (
        <div className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {def.helpText}
        </div>
      )}
      <div className="mt-2">
        {def.valueType === 'numeric' && (
          <Input
            type="number"
            value={value ?? 0}
            min={def.min}
            max={def.max}
            step="any"
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="h-8 tabular-nums"
          />
        )}
        {def.valueType === 'text' && (
          <Input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="h-8"
          />
        )}
        {def.valueType === 'boolean' && (
          <div className="flex items-center gap-2 py-1">
            <Switch
              checked={!!value}
              onCheckedChange={onChange}
            />
            <span className="text-xs text-muted-foreground">{value ? 'Enabled' : 'Disabled'}</span>
          </div>
        )}
        {def.valueType === 'select' && (
          <Select value={String(value ?? '')} onValueChange={onChange}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {def.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {def.valueType === 'json' && (
          <Input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
            onChange={(e) => {
              // Parse comma-separated for required_sheets etc
              const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              onChange(arr)
            }}
            className="h-8 font-mono text-xs"
          />
        )}
      </div>
    </div>
  )
}

function AuditPreview() {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/audit-logs?limit=5&action=rule_edit')
      .then(r => r.json())
      .then(d => setLogs(d?.logs ?? []))
  }, [])
  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No recent rule edits.</div>
  }
  return (
    <div className="space-y-1.5">
      {logs.map((l: any) => (
        <div key={l.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{l.description}</span>
          </div>
          <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
