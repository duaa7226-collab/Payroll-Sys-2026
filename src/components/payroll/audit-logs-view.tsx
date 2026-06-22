'use client'

import { useEffect, useState } from 'react'
import { ScrollText, Settings2, FileText, CarFront, Building2, Upload, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  rule_activate: { icon: Settings2, color: 'text-emerald-600', label: 'Rule Activated' },
  rule_edit: { icon: Settings2, color: 'text-amber-600', label: 'Rule Edited' },
  rule_create: { icon: Settings2, color: 'text-cyan-600', label: 'Rule Created' },
  import: { icon: Upload, color: 'text-violet-600', label: 'Workbook Imported' },
  export: { icon: Download, color: 'text-cyan-600', label: 'Export' },
  traffic_create: { icon: CarFront, color: 'text-rose-600', label: 'Traffic Violation Added' },
  traffic_update: { icon: CarFront, color: 'text-amber-600', label: 'Traffic Violation Updated' },
  company_update: { icon: Building2, color: 'text-violet-600', label: 'Company Updated' },
  payslip_gen: { icon: FileText, color: 'text-cyan-600', label: 'Payslip Generated' },
}

export function AuditLogsView() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    queueMicrotask(() => setLoading(true))
    const params = new URLSearchParams({ limit: '200' })
    if (filter !== 'all') params.set('action', filter)
    fetch(`/api/audit-logs?${params.toString()}`)
      .then(r => r.json())
      .then(d => setLogs(d?.logs ?? []))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Complete trail of all system actions · {logs.length} entries
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="rule_edit">Rule Edits</SelectItem>
            <SelectItem value="rule_activate">Rule Activations</SelectItem>
            <SelectItem value="import">Imports</SelectItem>
            <SelectItem value="traffic_create">Traffic Created</SelectItem>
            <SelectItem value="company_update">Company Updates</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="card-glow">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <ScrollText className="mx-auto h-10 w-10 opacity-40 mb-2" />
                No audit entries yet
              </div>
            ) : logs.map((l) => {
              const meta = ACTION_META[l.action] ?? { icon: ScrollText, color: 'text-muted-foreground', label: l.action }
              const Icon = meta.icon
              return (
                <div key={l.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{l.description}</span>
                      <Badge variant="outline" className="text-[9px]">{meta.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      by <span className="font-mono">{l.performedBy}</span>
                      {l.entityType && <span> · {l.entityType}</span>}
                      {l.entityId && <span> · {l.entityId.slice(-8)}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
