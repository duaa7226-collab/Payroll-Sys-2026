import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Mapping Configuration
// ============================================================================

/** RLVL template column → source Rider LVL column (calculation/payment only) */
const CALCULATION_MAP: Record<string, string> = {
  'Sum of completed_orders - إجمالي الطلبات المكتملة':
    'الطلبات المكتملة - completed_orders',

  'Sum of city_payment - إجمالي مدفوعات المدينة':
    'دفع المدينة - city_payment',

  'Sum of basic_payment - إجمالي الدفعة الأساسية':
    'الدفع الأساسي - basic_payment',

  'Sum of stacking_deduction - إجمالي خصم الطلبات المتعددة':
    'خصم الطلبات المتعددة - stacking_deduction',

  'Sum of declined_penalties_day_logic - إجمالي غرامات الرفض':
    'خصومات الرفض اليومية - declined_penalties_day_logic',

  'Sum of late_penalty - إجمالي غرامات التأخير':
    'خصم التأخير - late_penalty',

  'Sum of no_show_penalty - إجمالي غرامات عدم الحضور':
    'خصم عدم الحضور - no_show_penalty',

  'Sum of no_show_penalty_special_cities - إجمالي غرامات عدم الحضور للمدن الخاصة':
    'خصم عدم الحضور للمدن الخاصة - no_show_penalty_special_cities',

  'Sum of daily_acceptance_rate_penalty - إجمالي غرامة معدل القبول اليومي':
    'خصم معدل القبول اليومي - daily_acceptance_rate_penalty',

  'Sum of distance_payment - إجمالي مدفوعات المسافة':
    'بدل المسافة - distance_payment',

  'Sum of missed_days_penalty - إجمالي غرامات الأيام المفقودة':
    'خصم الأيام الغياب - missed_days_penalty',

  'Sum of segment_payment - إجمالي دفعة الشريحة':
    'بدل الفئات- segment_payment',

  'COURIER_BASIC_PAYMENT - الدفعة الأساسية للمندوب':
    'الدفع الأساسي للمندوب - rider_basic',

  'COURIER_SCORING_PAYMENT - دفعة التقييم للمندوب':
    'تقييم المندوب - rider_scoring',

  'Rider Balance - رصيد محفظة المندوب':
    'محفظة المندوب - Rider Balance',
}

/** RLVL columns that must be set to zero (no source equivalent) */
const ZERO_COLUMNS = [
  'Sum of acceptance_rate_penalties - إجمالي غرامات معدل القبول',
  'Sum of contact_rate_penalties - إجمالي غرامات معدل التواصل',
]

/** Identity/bank columns — preserved from template, never overwritten */
const IDENTITY_COLUMNS = [
  'Beneficiary اسم المستفيد',
  'البنك Bank',
  'IBAN رقم الايبان',
]

const TEMPLATE_SHEET = 'RLVL'
const SOURCE_SHEET = 'Rirder LVL'
const TEMPLATE_RIDER_ID = 'rider_id - معرف المندوب'
const SOURCE_RIDER_ID = 'معرف المندوب - rider_id'

// ============================================================================
// Types
// ============================================================================

interface ValidationError {
  en: string
  ar: string
}

interface RiderValidationRow {
  rider_id: string
  exists_in_template: boolean
  exists_in_source: boolean
  action: 'Mapped' | 'Template-only: review missing source rider' | 'Source-only: appended to output'
}

interface FieldValidationRow {
  RLVL_column: string
  Rider_LVL_column: string
  Rider_LVL_total: number
  Mapped_RLVL_total: number
  Difference: number
  Status: 'PASS' | 'FAIL'
}

// ============================================================================
// Helpers
// ============================================================================

function isXlsxFile(filename: string): boolean {
  return /\.xlsx$/i.test(filename)
}

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

/** Find a column by exact match, then by normalized startsWith, then includes. */
function findColumn(headers: string[], candidates: string[]): string | null {
  // Pass 1: exact match
  for (const cand of candidates) {
    const found = headers.find(h => h === cand)
    if (found) return found
  }
  // Pass 2: trimmed exact (case-insensitive)
  for (const cand of candidates) {
    const found = headers.find(h => h.trim().toLowerCase() === cand.trim().toLowerCase())
    if (found) return found
  }
  // Pass 3: startsWith (after trimming "Sum of " prefix noise)
  for (const cand of candidates) {
    const found = headers.find(h => h.trim().toLowerCase().startsWith(cand.trim().toLowerCase()))
    if (found) return found
  }
  // Pass 4: includes (last resort)
  for (const cand of candidates) {
    const found = headers.find(h => h.toLowerCase().includes(cand.toLowerCase()))
    if (found) return found
  }
  return null
}

/** Read sheet rows as array-of-objects with the original header strings preserved. */
function readSheet(wb: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null })
}

/** Get headers in original order from a sheet (preserves order, handles "Sum of" prefix). */
function getHeadersInOrder(wb: XLSX.WorkBook, sheetName: string): string[] {
  const sheet = wb.Sheets[sheetName]
  if (!sheet || !sheet['!ref']) return []
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null })
  if (rows.length === 0) return []
  return (rows[0] as any[]).map(h => (h === null || h === undefined ? '' : String(h).trim()))
}

// ============================================================================
// POST handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const templateFile = formData.get('templateFile') as File | null
    const sourceFile = formData.get('sourceFile') as File | null

    // 1. Both files exist
    if (!templateFile || !sourceFile) {
      const err: ValidationError = {
        en: 'Both template and source files are required.',
        ar: 'يلزم رفع ملف القالب وملف المصدر معًا.',
      }
      return NextResponse.json({ error: err }, { status: 400 })
    }

    // 2. Both files are .xlsx
    if (!isXlsxFile(templateFile.name) || !isXlsxFile(sourceFile.name)) {
      const err: ValidationError = {
        en: 'Both files must be .xlsx format.',
        ar: 'يجب أن يكون كلا الملفين بصيغة .xlsx.',
      }
      return NextResponse.json({ error: err }, { status: 400 })
    }

    // Read workbooks
    const templateBuffer = await templateFile.arrayBuffer()
    const sourceBuffer = await sourceFile.arrayBuffer()
    const templateWb = XLSX.read(templateBuffer, { type: 'array' })
    const sourceWb = XLSX.read(sourceBuffer, { type: 'array' })

    // 3. Template contains RLVL
    if (!templateWb.SheetNames.includes(TEMPLATE_SHEET)) {
      const err: ValidationError = {
        en: `Template file must contain a sheet named "${TEMPLATE_SHEET}". Found sheets: ${templateWb.SheetNames.join(', ')}`,
        ar: `ملف القالب يجب أن يحتوي على ورقة باسم "${TEMPLATE_SHEET}". الأوراق الموجودة: ${templateWb.SheetNames.join('، ')}`,
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }

    // 4. Source contains Rirder LVL
    if (!sourceWb.SheetNames.includes(SOURCE_SHEET)) {
      const err: ValidationError = {
        en: `Source file must contain a sheet named "${SOURCE_SHEET}". Found sheets: ${sourceWb.SheetNames.join(', ')}`,
        ar: `ملف المصدر يجب أن يحتوي على ورقة باسم "${SOURCE_SHEET}". الأوراق الموجودة: ${sourceWb.SheetNames.join('، ')}`,
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }

    // Get headers in order
    const templateHeaders = getHeadersInOrder(templateWb, TEMPLATE_SHEET)
    const sourceHeaders = getHeadersInOrder(sourceWb, SOURCE_SHEET)

    if (templateHeaders.length === 0) {
      const err: ValidationError = {
        en: 'Template RLVL sheet has no headers.',
        ar: 'ورقة RLVL في القالب لا تحتوي على رؤوس.',
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }
    if (sourceHeaders.length === 0) {
      const err: ValidationError = {
        en: 'Source Rirder LVL sheet has no headers.',
        ar: 'ورقة Rirder LVL في المصدر لا تحتوي على رؤوس.',
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }

    // 5. Rider ID columns exist
    const templateRiderIdCol = findColumn(templateHeaders, [TEMPLATE_RIDER_ID])
    const sourceRiderIdCol = findColumn(sourceHeaders, [SOURCE_RIDER_ID])

    if (!templateRiderIdCol) {
      const err: ValidationError = {
        en: `Template RLVL must contain rider ID column "${TEMPLATE_RIDER_ID}". Found headers: ${templateHeaders.join(', ')}`,
        ar: `ورقة RLVL في القالب يجب أن تحتوي على عمود معرف المندوب "${TEMPLATE_RIDER_ID}". الأعمدة الموجودة: ${templateHeaders.join('، ')}`,
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }
    if (!sourceRiderIdCol) {
      const err: ValidationError = {
        en: `Source Rirder LVL must contain rider ID column "${SOURCE_RIDER_ID}". Found headers: ${sourceHeaders.join(', ')}`,
        ar: `ورقة Rirder LVL في المصدر يجب أن تحتوي على عمود معرف المندوب "${SOURCE_RIDER_ID}". الأعمدة الموجودة: ${sourceHeaders.join('، ')}`,
      }
      return NextResponse.json({ error: err }, { status: 422 })
    }

    // 6. All required source calculation columns exist
    const missingSourceColumns: string[] = []
    for (const [rlvlCol, sourceCol] of Object.entries(CALCULATION_MAP)) {
      const found = findColumn(sourceHeaders, [sourceCol])
      if (!found) missingSourceColumns.push(`${sourceCol} (needed by RLVL column: ${rlvlCol})`)
    }
    if (missingSourceColumns.length > 0) {
      const err: ValidationError = {
        en: `Missing source calculation columns:\n${missingSourceColumns.map(c => `  - ${c}`).join('\n')}`,
        ar: `أعمدة الحسابات مفقودة من المصدر:\n${missingSourceColumns.map(c => `  - ${c}`).join('\n')}`,
      }
      return NextResponse.json({ error: err, missingColumns: missingSourceColumns }, { status: 422 })
    }

    // ===== Read sheet rows =====
    const templateRows = readSheet(templateWb, TEMPLATE_SHEET)
    const sourceRows = readSheet(sourceWb, SOURCE_SHEET)

    // ===== Build source rider map (by rider_id) =====
    // Map: riderId → { sourceColHeader → value }
    const sourceByRider = new Map<string, Record<string, any>>()
    for (const row of sourceRows) {
      const rid = String(row[sourceRiderIdCol] ?? '').trim()
      if (!rid) continue
      if (!sourceByRider.has(rid)) {
        sourceByRider.set(rid, row)
      }
    }

    // ===== Build template rider order =====
    const templateRiderOrder: string[] = []
    const templateRiderSet = new Set<string>()
    for (const row of templateRows) {
      const rid = String(row[templateRiderIdCol] ?? '').trim()
      if (!rid) continue
      if (!templateRiderSet.has(rid)) {
        templateRiderSet.add(rid)
        templateRiderOrder.push(rid)
      }
    }

    // ===== Detect Contract Name column in source (optional) =====
    const sourceContractCol = findColumn(sourceHeaders, ['Contract Name', 'contract_name', 'Contract'])

    // ===== Build output rows in template order, then append source-only riders =====
    const riderValidation: RiderValidationRow[] = []
    const outputRows: Record<string, any>[] = []

    // Pre-compute the actual source column header for each RLVL calculation column
    const resolvedCalcMap: { rlvlCol: string; sourceCol: string; resolvedSourceHeader: string }[] = []
    for (const [rlvlCol, sourceCol] of Object.entries(CALCULATION_MAP)) {
      const resolved = findColumn(sourceHeaders, [sourceCol])!
      resolvedCalcMap.push({ rlvlCol, sourceCol, resolvedSourceHeader: resolved })
    }

    // Detect identity column headers in template (preserve them with their values)
    const templateIdentityCols: string[] = []
    for (const idCol of IDENTITY_COLUMNS) {
      const found = findColumn(templateHeaders, [idCol])
      if (found) templateIdentityCols.push(found)
    }

    // Detect Contract Name column in template (optional)
    const templateContractCol = findColumn(templateHeaders, ['Contract Name', 'contract_name', 'Contract'])

    // ===== Process template riders (preserve order) =====
    for (const rid of templateRiderOrder) {
      const templateRow = templateRows.find(r => String(r[templateRiderIdCol] ?? '').trim() === rid)
      if (!templateRow) continue

      // Start from the template row (preserves all identity/bank columns + headers structure)
      const outRow: Record<string, any> = { ...templateRow }

      const sourceRow = sourceByRider.get(rid)
      const existsInSource = !!sourceRow

      if (sourceRow) {
        // Map calculation columns
        for (const { rlvlCol, resolvedSourceHeader } of resolvedCalcMap) {
          const rlvlHeaderActual = findColumn(templateHeaders, [rlvlCol])
          if (rlvlHeaderActual) {
            // Preserve blank values where source is blank; otherwise copy numeric
            const srcVal = sourceRow[resolvedSourceHeader]
            outRow[rlvlHeaderActual] = (srcVal === null || srcVal === undefined || srcVal === '')
              ? ''
              : num(srcVal)
          }
        }

        // Copy Contract Name from source (if template has a Contract Name column)
        if (templateContractCol && sourceContractCol) {
          const srcContract = sourceRow[sourceContractCol]
          if (srcContract !== null && srcContract !== undefined && srcContract !== '') {
            outRow[templateContractCol] = srcContract
          }
        }

        riderValidation.push({
          rider_id: rid,
          exists_in_template: true,
          exists_in_source: true,
          action: 'Mapped',
        })
      } else {
        // Template-only rider: keep row, retain identity, blank/zero calculation values
        for (const { rlvlCol } of resolvedCalcMap) {
          const rlvlHeaderActual = findColumn(templateHeaders, [rlvlCol])
          if (rlvlHeaderActual) {
            outRow[rlvlHeaderActual] = 0
          }
        }
        // Apply zero columns too
        for (const zeroCol of ZERO_COLUMNS) {
          const rlvlHeaderActual = findColumn(templateHeaders, [zeroCol])
          if (rlvlHeaderActual) outRow[rlvlHeaderActual] = 0
        }

        riderValidation.push({
          rider_id: rid,
          exists_in_template: true,
          exists_in_source: false,
          action: 'Template-only: review missing source rider',
        })
      }

      // Apply zero columns (for both mapped and template-only)
      for (const zeroCol of ZERO_COLUMNS) {
        const rlvlHeaderActual = findColumn(templateHeaders, [zeroCol])
        if (rlvlHeaderActual) outRow[rlvlHeaderActual] = 0
      }

      outputRows.push(outRow)
    }

    // ===== Append source-only riders at the end =====
    for (const [rid, sourceRow] of sourceByRider.entries()) {
      if (templateRiderSet.has(rid)) continue

      // Create a new row with the template's column structure
      const outRow: Record<string, any> = {}
      // Initialize all template columns to null
      for (const h of templateHeaders) outRow[h] = null
      // Set rider ID
      outRow[templateRiderIdCol] = rid

      // Map calculation columns
      for (const { rlvlCol, resolvedSourceHeader } of resolvedCalcMap) {
        const rlvlHeaderActual = findColumn(templateHeaders, [rlvlCol])
        if (rlvlHeaderActual) {
          const srcVal = sourceRow[resolvedSourceHeader]
          outRow[rlvlHeaderActual] = (srcVal === null || srcVal === undefined || srcVal === '')
            ? ''
            : num(srcVal)
        }
      }

      // Copy Contract Name from source
      if (templateContractCol && sourceContractCol) {
        const srcContract = sourceRow[sourceContractCol]
        if (srcContract !== null && srcContract !== undefined && srcContract !== '') {
          outRow[templateContractCol] = srcContract
        }
      }

      // Apply zero columns
      for (const zeroCol of ZERO_COLUMNS) {
        const rlvlHeaderActual = findColumn(templateHeaders, [zeroCol])
        if (rlvlHeaderActual) outRow[rlvlHeaderActual] = 0
      }

      // Identity columns left blank for source-only riders
      for (const idCol of templateIdentityCols) {
        outRow[idCol] = ''
      }

      riderValidation.push({
        rider_id: rid,
        exists_in_template: false,
        exists_in_source: true,
        action: 'Source-only: appended to output',
      })

      outputRows.push(outRow)
    }

    // ===== Build Validation sheet (field-level) =====
    const fieldValidation: FieldValidationRow[] = []

    for (const { rlvlCol, resolvedSourceHeader } of resolvedCalcMap) {
      const rlvlHeaderActual = findColumn(templateHeaders, [rlvlCol])

      // Source total (treat empty as 0 for validation)
      const sourceTotal = sourceRows.reduce((sum, row) => sum + num(row[resolvedSourceHeader]), 0)

      // Mapped total (from output rows)
      let mappedTotal = 0
      if (rlvlHeaderActual) {
        mappedTotal = outputRows.reduce((sum, row) => sum + num(row[rlvlHeaderActual]), 0)
      }

      const difference = mappedTotal - sourceTotal
      const status: 'PASS' | 'FAIL' = Math.abs(difference) < 0.005 ? 'PASS' : 'FAIL'

      fieldValidation.push({
        RLVL_column: rlvlCol,
        Rider_LVL_column: resolvedSourceHeader,
        Rider_LVL_total: Math.round(sourceTotal * 100) / 100,
        Mapped_RLVL_total: Math.round(mappedTotal * 100) / 100,
        Difference: Math.round(difference * 100) / 100,
        Status: status,
      })
    }

    // ===== Build output workbook =====
    const outWb = XLSX.utils.book_new()

    // Sheet 1: RLVL_Mapped — preserve template column order
    // Re-order each row to match templateHeaders exactly
    const orderedOutputRows = outputRows.map(row => {
      const ordered: Record<string, any> = {}
      for (const h of templateHeaders) ordered[h] = row[h] ?? null
      return ordered
    })
    const rlvlSheet = XLSX.utils.json_to_sheet(orderedOutputRows, { header: templateHeaders })
    XLSX.utils.book_append_sheet(outWb, rlvlSheet, 'RLVL_Mapped')

    // Sheet 2: Validation — field-level
    const validationSheet = XLSX.utils.json_to_sheet(fieldValidation, {
      header: ['RLVL_column', 'Rider_LVL_column', 'Rider_LVL_total', 'Mapped_RLVL_total', 'Difference', 'Status'],
    })
    // Set column widths for readability
    validationSheet['!cols'] = [
      { wch: 55 }, // RLVL_column
      { wch: 45 }, // Rider_LVL_column
      { wch: 18 }, // Rider_LVL_total
      { wch: 18 }, // Mapped_RLVL_total
      { wch: 14 }, // Difference
      { wch: 10 }, // Status
    ]
    XLSX.utils.book_append_sheet(outWb, validationSheet, 'Validation')

    // Sheet 3: Rider_Validation
    const riderValidationSheet = XLSX.utils.json_to_sheet(riderValidation, {
      header: ['rider_id', 'exists_in_template', 'exists_in_source', 'action'],
    })
    riderValidationSheet['!cols'] = [
      { wch: 18 }, // rider_id
      { wch: 22 }, // exists_in_template
      { wch: 18 }, // exists_in_source
      { wch: 50 }, // action
    ]
    XLSX.utils.book_append_sheet(outWb, riderValidationSheet, 'Rider_Validation')

    // ===== Write to buffer =====
    const outBuffer = XLSX.write(outWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(outBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="RLVL_calculation_columns_mapped.xlsx"',
      },
    })
  } catch (err: any) {
    console.error('map-rider-calculations failed:', err)
    const error: ValidationError = {
      en: `Processing failed: ${err?.message || 'Unknown error'}`,
      ar: `فشلت المعالجة: ${err?.message || 'خطأ غير معروف'}`,
    }
    return NextResponse.json({ error }, { status: 500 })
  }
}
