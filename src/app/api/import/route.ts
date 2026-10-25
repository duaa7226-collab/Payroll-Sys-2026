import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot } from '@/lib/rule-helpers'
import { parseWorkbook, type ParsedWorkbook } from '@/lib/excel-parser'
import { calculateDriverSalary, type DriverResultCalc, type RawDriverData } from '@/lib/salary-engine'
import { getAllRiderTrafficDeductions, processInstallmentDeductions } from '@/lib/traffic-helpers'
import { getAllRiderManualAdjustments } from '@/lib/manual-adjustment-helpers'
import { getActiveCustomBonuses, getBonusesForRider } from '@/lib/custom-bonus-helpers'
import { getActiveCustomDeductions, getDeductionsForRider, processCustomDeductionInstallments } from '@/lib/custom-deduction-helpers'
import { calculateIncome } from '@/lib/income-expenses-engine'
import { chunk, driverExceptionRows, driverResultCreateData, runWithConcurrency, sumTotals } from '@/lib/payroll-persist'
import { PAYROLL_JOB, withJobLock } from '@/lib/job-lock'
import { promises as fs } from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'
// Large workbooks take longer than the default route budget when the database
// is remote; keep the handler alive instead of dropping the response.
export const maxDuration = 120

const COMPANY_NAME = 'HungerStation'
// Guard rail for the archived original file (kept in Supabase as BYTEA).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const DEFAULT_EXPENSES = [
  { name: 'Iqama', amount: 1000, type: 'per_driver' },
  { name: 'Petrol', amount: 1200, type: 'per_driver' },
  { name: 'Car rent', amount: 1500, type: 'per_driver' },
  { name: 'Internet', amount: 115, type: 'per_driver' },
  { name: 'Office', amount: 18000, type: 'shared' },
  { name: 'Accommodation / flat', amount: 12000, type: 'shared' },
  { name: 'Saudis salary and insurance', amount: 12900, type: 'shared' },
  { name: 'Electricity and water', amount: 1000, type: 'shared' },
]

const MONTH_INDEX: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', august: '08', sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
}

/** "May 2026" → "2026-05" (falls back to the current month). */
function monthKeyFromLabel(label: string): string {
  const parts = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)
  const year = parts.find(p => /^\d{4}$/.test(p)) || String(new Date().getFullYear())
  for (const part of parts) {
    const month = MONTH_INDEX[part]
    if (month) return `${year}-${month}`
  }
  return new Date().toISOString().slice(0, 7)
}

async function saveUploadedWorkbook(fileName: string, buffer: Buffer) {
  try {
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'upload')
    await fs.mkdir(uploadDir, { recursive: true })
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await fs.writeFile(path.join(uploadDir, `${stamp}_${safeName}`), buffer)
  } catch (e) {
    // Reference copies are nice-to-have; never fail an import over them.
    console.warn('Could not save uploaded workbook to disk:', e)
  }
}

// POST /api/import — accepts multipart/form-data with file + payrollMonth
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth

  return withJobLock(PAYROLL_JOB, 'Excel import & calculation', async () => {
    try {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const payrollMonth = String(formData.get('payrollMonth') || '').trim()
        || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }
      if (file.size === 0) {
        return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 })
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: 'File too large', message: `Workbooks are limited to ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` },
          { status: 413 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      // Keep a reference copy (best effort, non-blocking failures).
      await saveUploadedWorkbook(file.name, buffer)

      let parsed: ParsedWorkbook
      try {
        parsed = parseWorkbook(buffer)
      } catch (e: any) {
        return NextResponse.json(
          {
            error: 'Workbook parsing failed',
            message: e.message,
            warnings: [],
          },
          { status: 422 }
        )
      }

      if (parsed.drivers.length === 0) {
        return NextResponse.json(
          {
            error: 'No driver rows found',
            message: 'The RLVL sheet contains no rider rows with a rider_id. Check the workbook before importing.',
            warnings: parsed.warnings,
          },
          { status: 422 }
        )
      }

      const warnings = [...parsed.warnings]
      const riderIds = parsed.drivers.map(d => d.riderId)
      const incomeMonth = monthKeyFromLabel(payrollMonth)

      // Everything the calculation needs, fetched in parallel (one round-trip
      // per data source instead of one per driver).
      const [
        activeRules,
        trafficByRider,
        manualByRider,
        customBonuses,
        customDeductions,
        previousSameMonthRun,
        knownDrivers,
      ] = await Promise.all([
        getActiveRuleSnapshot(),
        getAllRiderTrafficDeductions(riderIds),
        getAllRiderManualAdjustments(riderIds),
        getActiveCustomBonuses(),
        getActiveCustomDeductions(),
        db.payrollRun.findFirst({ where: { payrollMonth }, select: { id: true } }),
        db.driver.findMany({ where: { riderId: { in: riderIds } } }),
      ])

      // ===== Sync driver master data (bulk insert + only changed updates) =====
      const existingByRider = new Map(knownDrivers.map(d => [d.riderId, d]))
      const driverData = parsed.drivers.map(raw => {
        const perDriver = parsed.driverBanking?.[raw.riderId]
        const fallback = existingByRider.get(raw.riderId)
        return {
          riderId: raw.riderId,
          name: raw.name || fallback?.name || `Rider ${raw.riderId}`,
          contractName: raw.contractName || fallback?.contractName || 'nokhaba_tatweer_ftr',
          vehicleType: raw.vehicleType || fallback?.vehicleType || 'car',
          beneficiaryName: perDriver?.beneficiaryName || parsed.banking?.beneficiaryName || fallback?.beneficiaryName || null,
          iban: perDriver?.iban || parsed.banking?.iban || fallback?.iban || null,
          bankName: perDriver?.bankName || parsed.banking?.bankName || fallback?.bankName || null,
        }
      })

      const newDrivers = driverData.filter(d => !existingByRider.has(d.riderId))
      if (newDrivers.length > 0) {
        await db.driver.createMany({ data: newDrivers, skipDuplicates: true })
      }

      // Re-read: gives us ids for new drivers and current values for the rest.
      const syncedDrivers = await db.driver.findMany({
        where: { riderId: { in: riderIds } },
        select: {
          id: true, riderId: true, name: true, contractName: true, vehicleType: true,
          beneficiaryName: true, iban: true, bankName: true,
        },
      })
      const driverByRider = new Map(syncedDrivers.map(d => [d.riderId, d]))

      const updateTasks: Array<() => Promise<unknown>> = []
      for (const d of driverData) {
        const current = driverByRider.get(d.riderId)
        if (!current) continue
        const changed =
          current.name !== d.name ||
          current.contractName !== d.contractName ||
          current.vehicleType !== d.vehicleType ||
          (current.beneficiaryName ?? null) !== d.beneficiaryName ||
          (current.iban ?? null) !== d.iban ||
          (current.bankName ?? null) !== d.bankName
        if (!changed) continue
        updateTasks.push(() =>
          db.driver.update({
            where: { id: current.id },
            data: {
              name: d.name,
              contractName: d.contractName,
              vehicleType: d.vehicleType,
              beneficiaryName: d.beneficiaryName,
              iban: d.iban,
              bankName: d.bankName,
            },
          })
        )
      }
      // Bounded concurrency: fast on a remote pooler without exhausting it.
      await runWithConcurrency(updateTasks, 10)

      // ===== Single calculation pass over every driver =====
      const calculated: Array<{ driverId: string; result: DriverResultCalc; raw: RawDriverData }> = []
      for (const raw of parsed.drivers) {
        const driver = driverByRider.get(raw.riderId)
        if (!driver) {
          warnings.push(`Rider ${raw.riderId} could not be stored and was skipped`)
          continue
        }

        raw.trafficViolationsTotal = trafficByRider.get(raw.riderId)?.total ?? 0
        raw.customBonuses = getBonusesForRider(customBonuses, raw.riderId).map(b => ({
          name: b.name, nameAr: b.nameAr, amount: b.amount,
        }))
        raw.customDeductions = getDeductionsForRider(customDeductions, raw.riderId).map(d => ({
          name: d.name, nameAr: d.nameAr, amount: d.amount, monthlyDeduction: d.monthlyDeduction,
        }))
        raw.manualBonuses = (manualByRider.get(raw.riderId)?.bonuses ?? []).map(b => ({
          title: b.title, titleAr: b.titleAr, amount: b.amount,
        }))
        raw.manualDeductions = (manualByRider.get(raw.riderId)?.deductions ?? []).map(d => ({
          title: d.title, titleAr: d.titleAr, amount: d.amount,
        }))

        const result = calculateDriverSalary(raw, activeRules.snapshot, activeRules.ruleSetName, payrollMonth)
        calculated.push({ driverId: driver.id, result, raw })
      }

      if (calculated.length === 0) {
        return NextResponse.json(
          { error: 'Calculation produced no rows', message: 'No driver records could be matched to the workbook.', warnings },
          { status: 422 }
        )
      }

      const results = calculated.map(entry => entry.result)
      const totals = sumTotals(results)

      // ===== Derived income records (computed in memory, written in bulk) =====
      const incomeRows = calculated.map(({ driverId, result }) => {
        const p = result.penalties
        const incomeData = {
          driverId,
          driverName: result.driverName,
          companyName: COMPANY_NAME,
          basicPayment: result.uploadedBasicPayment || 0,
          distancePayment: p.distance || 0,
          segmentPayment: p.segment || 0,
          acceptancePenalty: p.acceptance || 0,
          contactPenalty: p.contact || 0,
          stackingDeduction: p.stacking || 0,
          declinedPenalty: p.declined || 0,
          latePenalty: p.late || 0,
          noShowPenalty: p.noshow || 0,
          noShowSpecialPenalty: p.noshow_special || 0,
          dailyAcceptancePenalty: p.daily_acceptance || 0,
          missedDaysPenalty: p.missed_days || 0,
          riderBalance: p.rider_balance || 0,
          customFieldsJson: null,
          sourceFile: file.name,
          importedBy: auth.email || 'auto-sync',
        }
        const calc = calculateIncome(incomeData)
        return {
          month: incomeMonth,
          riderId: result.riderId,
          ...incomeData,
          totalIncome: calc.totalIncome,
          totalPenalties: calc.totalPenalties,
        }
      })

      // ===== One atomic write for the whole payroll run =====
      const payrollRunId = await db.$transaction(async tx => {
        const run = await tx.payrollRun.create({
          data: {
            payrollMonth,
            fileName: file.name,
            ruleSetId: activeRules.ruleSetId,
            ruleSnapshot: JSON.stringify(activeRules.snapshot),
            status: 'processing',
            importedBy: auth.email || 'import',
          },
          select: { id: true },
        })

        // One bulk insert per 200 drivers instead of one INSERT per driver.
        const rows = calculated.map(entry => driverResultCreateData(run.id, entry.driverId, entry.result))
        for (const batch of chunk(rows, 200)) {
          await tx.driverResult.createMany({ data: batch })
        }

        const exceptions = [
          ...warnings.map(w => ({
            payrollRunId: run.id,
            code: 'IMPORT_WARNING',
            severity: 'warning',
            source: 'parser',
            message: w,
            suggestedAction: 'Review source workbook structure',
          })),
          ...results.flatMap(result => driverExceptionRows(run.id, result)),
        ]
        for (const batch of chunk(exceptions, 500)) {
          await tx.payrollException.createMany({ data: batch })
        }

        await tx.payrollRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            totalDrivers: results.length,
            ...totals,
          },
        })

        await tx.auditLog.create({
          data: {
            action: 'import',
            entityType: 'payroll_run',
            entityId: run.id,
            ruleSetId: activeRules.ruleSetId,
            performedBy: auth.email || 'import',
            description: `Imported ${file.name} for ${payrollMonth} — ${results.length} drivers`,
            metadata: JSON.stringify({
              fileName: file.name,
              driverCount: results.length,
              warnings: warnings.length,
              ruleSetName: activeRules.ruleSetName,
              ruleCount: activeRules.ruleCount,
              incomeMonth,
            }),
          },
        })

        return run.id
      }, { maxWait: 15_000, timeout: 90_000 })

      // ===== Archive the original workbook (kept until explicitly deleted) =====
      let uploadedFileId: string | null = null
      try {
        const archived = await db.uploadedFile.create({
          data: {
            fileName: file.name,
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: buffer.length,
            payrollMonth,
            driverCount: results.length,
            uploadedBy: auth.email || 'import',
            payrollRunId,
            data: buffer,
          },
          select: { id: true },
        })
        uploadedFileId = archived.id
      } catch (archiveErr) {
        // Never fail an import because the archive could not be written.
        console.error('Workbook archive failed (non-fatal):', archiveErr)
        warnings.push('Payroll calculated, but the original workbook could not be archived to Upload History. Check the server log.')
      }

      // ===== Auto-sync the Income vs Expenses module (non-fatal) =====
      let incomeSync: { month: string; records: number } | null = null
      try {
        await db.$transaction(async tx => {
          await tx.incomeRecord.deleteMany({ where: { month: incomeMonth, companyName: COMPANY_NAME } })
          for (const batch of chunk(incomeRows, 200)) {
            await tx.incomeRecord.createMany({ data: batch, skipDuplicates: true })
          }

          await tx.driverCount.upsert({
            where: { month: incomeMonth },
            create: {
              month: incomeMonth,
              activeDriverCount: results.length,
              notes: `Auto-synced from ${payrollMonth}`,
              confirmedBy: auth.email || 'auto-sync',
            },
            update: {
              activeDriverCount: results.length,
              notes: `Auto-synced from ${payrollMonth}`,
              confirmedBy: auth.email || 'auto-sync',
            },
          })

          const existingExpenses = await tx.expense.findMany({
            where: { month: incomeMonth },
            select: { categoryName: true },
          })
          const existingCategories = new Set(existingExpenses.map(e => e.categoryName))
          const newExpenseRows: Array<{
            month: string
            categoryId: string
            categoryName: string
            amount: number
            allocationType: string
            notes: string
            createdBy: string
          }> = []

          for (const def of DEFAULT_EXPENSES) {
            if (existingCategories.has(def.name)) continue
            const category = await tx.expenseCategory.upsert({
              where: { name: def.name },
              create: { name: def.name, defaultAmount: def.amount, allocationType: def.type },
              update: {},
              select: { id: true, name: true },
            })
            newExpenseRows.push({
              month: incomeMonth,
              categoryId: category.id,
              categoryName: category.name,
              amount: def.amount,
              allocationType: def.type,
              notes: 'Auto-seeded during import',
              createdBy: auth.email || 'auto-sync',
            })
          }
          if (newExpenseRows.length > 0) {
            await tx.expense.createMany({ data: newExpenseRows })
          }
        }, { maxWait: 15_000, timeout: 60_000 })
        incomeSync = { month: incomeMonth, records: incomeRows.length }
      } catch (syncErr) {
        console.error('Auto-sync income/expenses failed (non-fatal):', syncErr)
        warnings.push('Payroll was imported, but the Income vs Expenses auto-sync failed. Use that module to sync manually.')
      }

      // ===== Installments advance once per NEW payroll month =====
      // Re-uploading the same month or recalculating must never charge an
      // installment twice.
      if (!previousSameMonthRun) {
        try {
          await processCustomDeductionInstallments()
          await processInstallmentDeductions(riderIds)
        } catch (installmentErr) {
          console.error('Installment processing failed (non-fatal):', installmentErr)
          warnings.push('Installment progress could not be advanced for this month.')
        }
      }

      return NextResponse.json({
        success: true,
        payrollRunId,
        uploadedFileId,
        driverCount: results.length,
        warnings,
        totals,
        incomeSync,
        rules: {
          ruleSetName: activeRules.ruleSetName,
          ruleCount: activeRules.ruleCount,
          autoInitialized: activeRules.createdRuleSet || activeRules.addedRuleCount > 0,
          addedRuleCount: activeRules.addedRuleCount,
        },
        installmentsAdvanced: !previousSameMonthRun,
      })
    } catch (e: any) {
      console.error('Import failed:', e)
      return NextResponse.json(
        {
          error: 'Import failed',
          message: e?.message || 'Unexpected error while importing the workbook.',
        },
        { status: 500 }
      )
    }
  }) as Promise<NextResponse>
}
