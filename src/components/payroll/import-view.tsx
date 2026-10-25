'use client'

import { useState, useRef } from 'react'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2,
  FileText, Calendar, FileCheck2, ShieldCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export function ImportView({ onImported }: { onImported: (runId: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [payrollMonth, setPayrollMonth] = useState(
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  )
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('payrollMonth', payrollMonth)

      const resp = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })
      const data = await resp.json()
      if (resp.ok && data.success) {
        setResult(data)
        toast.success(`Imported ${data.driverCount} drivers for ${payrollMonth}`)
      } else {
        setError(data.message || data.error || 'Import failed')
        toast.error(data.message || data.error || 'Import failed')
      }
    } catch (e: any) {
      setError(e.message)
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Monthly Workbook Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload the recurring monthly Excel workbook — system auto-parses RLVL, FTR Cost, and WR sheets
        </p>
      </div>

      {/* Required sheets info */}
      <Card className="card-glow border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-950/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Required Sheets
            </div>
            {['RLVL', 'FTR Cost', 'WR'].map(s => (
              <Badge key={s} variant="outline" className="font-mono text-[10px]">{s}</Badge>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              Optional: Car Rental · Traffic Violations sheet
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload zone */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-base">1. Select Workbook</CardTitle>
            <CardDescription>Choose the monthly Excel file (.xlsx)</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="grid h-48 place-items-center rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="text-center">
                  <FileCheck2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <div className="mt-2 font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-rose-500"
                    onClick={(e) => { e.stopPropagation(); handleReset() }}
                  >
                    <X className="mr-1 h-3 w-3" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground/60" />
                  <div className="mt-2 text-sm font-medium">Drop Excel file here or click to browse</div>
                  <div className="text-xs text-muted-foreground">.xlsx, .xls · max 10MB</div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Label className="text-xs">Payroll Month</Label>
              <div className="mt-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  placeholder="e.g. June 2026"
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action & result */}
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-base">2. Process & Calculate</CardTitle>
            <CardDescription>System applies active rules and generates payroll results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="font-semibold mb-1">Processing flow:</div>
              <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Validate required sheets (RLVL, FTR Cost, WR)</li>
                <li>Parse rows and join by rider_id</li>
                <li>Apply active rule set from Rules Control Center</li>
                <li>Calculate salary for each driver (orders-based or days-prorated)</li>
                <li>Detect exceptions and variance</li>
                <li>Generate payslips-ready results</li>
              </ol>
            </div>

            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import & Calculate
                </>
              )}
            </Button>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/40 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-rose-700 dark:text-rose-300">Import failed</div>
                    <div className="text-xs mt-1">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/40 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Successfully imported {result.driverCount} drivers
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Total Gross" value={`SAR ${result.totals.totalGross.toFixed(2)}`} />
                      <Stat label="Total Net" value={`SAR ${result.totals.totalNet.toFixed(2)}`} accent="emerald" />
                      <Stat label="Total Penalties" value={`SAR ${result.totals.totalPenalties.toFixed(2)}`} accent="rose" />
                      <Stat label="Total Variance" value={`SAR ${result.totals.totalVariance.toFixed(2)}`} accent="amber" />
                    </div>
                    {result.rules?.autoInitialized && (
                      <div className="mt-2 rounded border border-border bg-card p-2 text-xs text-muted-foreground">
                        <ShieldCheck className="inline h-3 w-3 mr-1 text-emerald-600" />
                        Rules Control Center initialized with all {result.rules.ruleCount} rules ({result.rules.ruleSetName}). Review or tune them before the next run.
                      </div>
                    )}
                    {result.warnings.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        <AlertCircle className="inline h-3 w-3 mr-1" />
                        {result.warnings.length} warning(s) — see Exceptions tab
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => onImported(result.payrollRunId)}
                    >
                      View Dashboard →
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reference — current file */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Reference: May 2026 Sample Workbook
          </CardTitle>
          <CardDescription>Currently loaded as default seed data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="File Name" value="nokhaba_tatweer_ftr_Invoice-Issue-May-2026_with_names_fixed.xlsx" mono />
            <Info label="Contract" value="nokhaba_tatweer_ftr" mono />
            <Info label="Drivers" value="8" />
            <Info label="Payroll Month" value="May 2026" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'rose' | 'amber' }) {
  const colorMap = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    rose: 'text-rose-700 dark:text-rose-300',
    amber: 'text-amber-700 dark:text-amber-300',
  }
  return (
    <div className="rounded border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${accent ? colorMap[accent] : ''}`}>{value}</div>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
