'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SEVERITY_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  error: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/30', label: 'Error' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Warning' },
  info: { icon: Info, color: 'text-cyan-600', bg: 'bg-cyan-500/10 border-cyan-500/30', label: 'Info' },
}

export function ExceptionsView({ runId }: { runId: string | null }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return
    queueMicrotask(() => setLoading(true))
    fetch(`/api/exceptions?runId=${runId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading...</div>
  }

  const exceptions = data?.exceptions ?? []
  const bySeverity = data?.bySeverity ?? { error: 0, warning: 0, info: 0 }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Exceptions Center</h1>
        <p className="text-sm text-muted-foreground">
          Validation errors, variance issues, and review flags from the payroll run
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="card-glow border-rose-200 dark:border-rose-900/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</div>
              <div className="text-xl font-bold tabular-nums">{bySeverity.error}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glow border-amber-200 dark:border-amber-900/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Warnings</div>
              <div className="text-xl font-bold tabular-nums">{bySeverity.warning}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glow border-cyan-200 dark:border-cyan-900/40">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Info</div>
              <div className="text-xl font-bold tabular-nums">{bySeverity.info}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exceptions list */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base">All Exceptions ({exceptions.length})</CardTitle>
          <CardDescription>Most recent first · grouped by severity</CardDescription>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
              <div className="font-medium">No exceptions detected</div>
              <div className="text-xs mt-1">This payroll run is clean</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {exceptions.map((e: any) => {
                const meta = SEVERITY_META[e.severity] ?? SEVERITY_META.info
                const Icon = meta.icon
                return (
                  <div key={e.id} className={`rounded-lg border p-3 ${meta.bg}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[9px] ${meta.color} border-current`}>
                            {e.code}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            source: {e.source} {e.rowRef && `· rider: ${e.rowRef}`}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-medium">{e.message}</div>
                        {e.suggestedAction && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-semibold">Action:</span> {e.suggestedAction}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px]">{e.reviewStatus}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
