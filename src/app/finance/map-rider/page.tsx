'use client'

import { useState, useRef } from 'react'
import { FileSpreadsheet, Upload, Download, Loader2, AlertCircle, CheckCircle2, ArrowRight, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function MapRiderPage() {
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const templateInputRef = useRef<HTMLInputElement>(null)
  const sourceInputRef = useRef<HTMLInputElement>(null)

  const handleTemplateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setTemplateFile(f)
    setError(null)
    setSuccess(null)
  }

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setSourceFile(f)
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    if (!templateFile || !sourceFile) {
      setError('يرجى اختيار كلا الملفين · Please select both files.')
      return
    }

    if (!/\.xlsx$/i.test(templateFile.name) || !/\.xlsx$/i.test(sourceFile.name)) {
      setError('يجب أن يكون كلا الملفين بصيغة .xlsx · Both files must be .xlsx format.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('templateFile', templateFile)
      formData.append('sourceFile', sourceFile)

      const resp = await fetch('/api/finance/map-rider-calculations', {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        // Try to parse JSON error
        const ct = resp.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const data = await resp.json()
          const errMsg = data?.error
          if (typeof errMsg === 'object' && errMsg !== null) {
            setError(`${errMsg.en}\n${errMsg.ar}`)
          } else if (typeof errMsg === 'string') {
            setError(errMsg)
          } else if (Array.isArray(data?.missingColumns) && data.missingColumns.length > 0) {
            setError(`Missing source columns:\n${data.missingColumns.map((c: string) => `  - ${c}`).join('\n')}`)
          } else {
            setError(`Error ${resp.status}: ${resp.statusText}`)
          }
        } else {
          setError(`Error ${resp.status}: ${resp.statusText}`)
        }
        return
      }

      // Success — download the file
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Use filename from content-disposition if available, else default
      const cd = resp.headers.get('content-disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/i)
      a.download = match?.[1] || 'RLVL_calculation_columns_mapped.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setSuccess('تم إنشاء الملف بنجاح · File generated successfully.')
    } catch (err: any) {
      setError(`Network error: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          Map Rider Calculations
          <span className="text-base font-normal text-muted-foreground" dir="rtl">
            · تعيين أعمدة حسابات المندوبين
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Map calculation columns from Rider LVL source file into the RLVL template structure.
          Identity/bank fields are preserved from the template.
        </p>
        <p className="mt-1 text-sm text-muted-foreground" dir="rtl">
          تعيين أعمدة الحسابات من ملف مصدر Rider LVL إلى هيكل قالب RLVL.
          يتم الحفاظ على بيانات البنك والمستفيد من القالب دون تغيير.
        </p>
      </div>

      {/* How it works */}
      <Card className="card-glow border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-foreground">How it works · كيفية العمل</div>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Upload the <strong>Template</strong> file containing the <code className="px-1 py-0.5 rounded bg-muted">RLVL</code> sheet (e.g., June export).</li>
                <li>Upload the <strong>Source</strong> file containing the <code className="px-1 py-0.5 rounded bg-muted">Rirder LVL</code> sheet (e.g., July raw data).</li>
                <li>The system maps calculation columns by <strong>rider_id</strong> (not by row position).</li>
                <li>Identity columns (Beneficiary, Bank, IBAN) are <strong>preserved</strong> from the template.</li>
                <li>The output <code className="px-1 py-0.5 rounded bg-muted">RLVL_calculation_columns_mapped.xlsx</code> contains 3 sheets: RLVL_Mapped, Validation, Rider_Validation.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File upload cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Template file */}
        <Card className={`card-glow transition-colors ${templateFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dashed'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              1. Template File · ملف القالب
            </CardTitle>
            <CardDescription className="text-xs">
              Must contain sheet: <code className="px-1 py-0.5 rounded bg-muted">RLVL</code>
              <br />
              <span dir="rtl">يجب أن يحتوي على ورقة: <code className="px-1 py-0.5 rounded bg-muted">RLVL</code></span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={templateInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleTemplateChange}
              className="hidden"
              id="template-file-input"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => templateInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {templateFile ? templateFile.name : 'Choose Template .xlsx · اختر ملف القالب'}
            </Button>
            {templateFile && (
              <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Selected · تم الاختيار: {templateFile.name}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source file */}
        <Card className={`card-glow transition-colors ${sourceFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-dashed'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              2. Source File · ملف المصدر
            </CardTitle>
            <CardDescription className="text-xs">
              Must contain sheet: <code className="px-1 py-0.5 rounded bg-muted">Rirder LVL</code>
              <br />
              <span dir="rtl">يجب أن يحتوي على ورقة: <code className="px-1 py-0.5 rounded bg-muted">Rirder LVL</code></span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={sourceInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleSourceChange}
              className="hidden"
              id="source-file-input"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => sourceInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {sourceFile ? sourceFile.name : 'Choose Source .xlsx · اختر ملف المصدر'}
            </Button>
            {sourceFile && (
              <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Selected · تم الاختيار: {sourceFile.name}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={loading || !templateFile || !sourceFile}
          className="min-w-[280px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing... · جارٍ المعالجة
            </>
          ) : (
            <>
              <ArrowRight className="mr-2 h-4 w-4" />
              Map Calculation Columns &amp; Download
              <span className="mx-1 opacity-50">·</span>
              <span dir="rtl">تعيين الأعمدة والتنزيل</span>
              <Download className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Output: <code className="px-1 py-0.5 rounded bg-muted">RLVL_calculation_columns_mapped.xlsx</code> ·
          3 sheets (RLVL_Mapped, Validation, Rider_Validation)
        </p>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error · خطأ</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {success && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success · نجاح</AlertTitle>
          <AlertDescription className="text-xs">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Mapping reference */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm">Mapped Calculation Columns · أعمدة الحسابات المعينة</CardTitle>
          <CardDescription className="text-xs">
            {`Only these columns are mapped from source to template. All other columns are preserved from the template.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 text-[10px]">
            <div className="space-y-1">
              <div className="font-semibold text-primary">From Source (Rirder LVL) →</div>
              <div className="text-muted-foreground">الطلبات المكتملة - completed_orders</div>
              <div className="text-muted-foreground">دفع المدينة - city_payment</div>
              <div className="text-muted-foreground">الدفع الأساسي - basic_payment</div>
              <div className="text-muted-foreground">خصم الطلبات المتعددة - stacking_deduction</div>
              <div className="text-muted-foreground">خصومات الرفض اليومية - declined_penalties_day_logic</div>
              <div className="text-muted-foreground">خصم التأخير - late_penalty</div>
              <div className="text-muted-foreground">خصم عدم الحضور - no_show_penalty</div>
              <div className="text-muted-foreground">خصم عدم الحضور للمدن الخاصة - no_show_penalty_special_cities</div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-primary">→ To Template (RLVL)</div>
              <div className="text-muted-foreground">Sum of completed_orders - إجمالي الطلبات المكتملة</div>
              <div className="text-muted-foreground">Sum of city_payment - إجمالي مدفوعات المدينة</div>
              <div className="text-muted-foreground">Sum of basic_payment - إجمالي الدفعة الأساسية</div>
              <div className="text-muted-foreground">Sum of stacking_deduction - إجمالي خصم الطلبات المتعددة</div>
              <div className="text-muted-foreground">Sum of declined_penalties_day_logic - إجمالي غرامات الرفض</div>
              <div className="text-muted-foreground">Sum of late_penalty - إجمالي غرامات التأخير</div>
              <div className="text-muted-foreground">Sum of no_show_penalty - إجمالي غرامات عدم الحضور</div>
              <div className="text-muted-foreground">Sum of no_show_penalty_special_cities - إجمالي غرامات عدم الحضور للمدن الخاصة</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 text-[10px] text-muted-foreground">
            <div>
              <strong>Zero columns</strong> (no source equivalent, set to 0):
              <ul className="list-disc list-inside mt-1">
                <li>Sum of acceptance_rate_penalties - إجمالي غرامات معدل القبول</li>
                <li>Sum of contact_rate_penalties - إجمالي غرامات معدل التواصل</li>
              </ul>
            </div>
            <div className="mt-2">
              <strong>Identity columns</strong> (preserved from template, never overwritten):
              <ul className="list-disc list-inside mt-1">
                <li>Beneficiary اسم المستفيد</li>
                <li>البنك Bank</li>
                <li>IBAN رقم الايبان</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
