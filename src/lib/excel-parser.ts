// Excel workbook parser — accepts monthly upload (RLVL, FTR Cost, WR, Car Rental)
// Uses xlsx library. Joins by rider_id. Returns normalized driver list.
import * as XLSX from 'xlsx'
import type { RawDriverData } from './salary-engine'

export interface ParsedWorkbook {
  drivers: RawDriverData[]
  wrRow: Record<string, any> | null
  sheetNames: string[]
  warnings: string[]
}

// Column name normalization — strip arabic side, lowercase, snake_case
function norm(s: string): string {
  if (!s) return ''
  return String(s)
    .split(' - ')[0] // take English side if bilingual
    .replace(/Sum of /i, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function findCol(headers: string[], ...candidates: string[]): string | null {
  const normalized = headers.map(h => ({ raw: h, norm: norm(h) }))
  // Pass 1: exact match (prevents 'working_days' from matching 'fully_working_days')
  for (const cand of candidates) {
    const c = cand.toLowerCase().replace(/\s+/g, '_')
    const found = normalized.find(h => h.norm === c)
    if (found) return found.raw
  }
  // Pass 2: starts-with match (e.g., 'rider_id' matches 'rider_id - معرف')
  for (const cand of candidates) {
    const c = cand.toLowerCase().replace(/\s+/g, '_')
    const found = normalized.find(h => h.norm.startsWith(c))
    if (found) return found.raw
  }
  // Pass 3: fuzzy includes (last resort)
  for (const cand of candidates) {
    const c = cand.toLowerCase()
    const found = normalized.find(h => h.raw.toLowerCase().includes(c))
    if (found) return found.raw
  }
  return null
}

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: 'array' })
  const warnings: string[] = []
  const sheetNames = wb.SheetNames

  // Find RLVL sheet
  const rlvlSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('rlvl'))
  if (!rlvlSheetName) {
    throw new Error('RLVL sheet not found. Required sheet missing.')
  }
  // Find FTR Cost sheet
  const ftrSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('ftr'))
  if (!ftrSheetName) {
    throw new Error('FTR Cost sheet not found. Required sheet missing.')
  }
  // Find WR sheet (optional but recommended)
  const wrSheetName = wb.SheetNames.find(n => n.toLowerCase() === 'wr' || n.toLowerCase().includes('wr'))

  // ====== Parse RLVL ======
  const rlvlRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[rlvlSheetName], { defval: null })
  if (rlvlRows.length === 0) throw new Error('RLVL sheet is empty')
  const rlvlHeaders = Object.keys(rlvlRows[0])

  const riderIdCol = findCol(rlvlHeaders, 'rider_id', 'riderid')
  const nameCol = findCol(rlvlHeaders, 'name')
  const contractCol = findCol(rlvlHeaders, 'contract_name', 'contract name')
  const completedOrdersCol = findCol(rlvlHeaders, 'completed_orders')
  const cityPaymentCol = findCol(rlvlHeaders, 'city_payment')
  const basicPaymentCol = findCol(rlvlHeaders, 'basic_payment')
  const acceptanceCol = findCol(rlvlHeaders, 'acceptance_rate_penalties')
  const contactCol = findCol(rlvlHeaders, 'contact_rate_penalties')
  const stackingCol = findCol(rlvlHeaders, 'stacking_deduction')
  const declinedCol = findCol(rlvlHeaders, 'declined_penalties_day_logic', 'declined_penalties')
  const lateCol = findCol(rlvlHeaders, 'late_penalty')
  const noshowCol = findCol(rlvlHeaders, 'no_show_penalty')
  const noshowSpecialCol = findCol(rlvlHeaders, 'no_show_penalty_special_cities')
  const dailyAcceptanceCol = findCol(rlvlHeaders, 'daily_acceptance_rate_penalty')
  const distanceCol = findCol(rlvlHeaders, 'distance_payment')
  const missedDaysCol = findCol(rlvlHeaders, 'missed_days_penalty')
  const segmentCol = findCol(rlvlHeaders, 'segment_payment')
  const riderBalanceCol = findCol(rlvlHeaders, 'rider_balance')

  if (!riderIdCol) throw new Error('Cannot find rider_id column in RLVL sheet')

  // ====== Parse FTR Cost ======
  const ftrRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[ftrSheetName], { defval: null })
  const ftrHeaders = ftrRows.length > 0 ? Object.keys(ftrRows[0]) : []
  const ftrRiderIdCol = findCol(ftrHeaders, 'rider_id', 'riderid')
  const ftrNameCol = findCol(ftrHeaders, 'name')
  const ftrContractCol = findCol(ftrHeaders, 'contract_name', 'contract name')
  const vehicleCol = findCol(ftrHeaders, 'rider_vehicle_type', 'vehicle_type')
  const totalMonthlyHoursCol = findCol(ftrHeaders, 'total_monthly_working_hours')
  const workingHoursCol = findCol(ftrHeaders, 'working_hours')
  const fullyWorkingDaysCol = findCol(ftrHeaders, 'fully_working_days')
  const workingDaysCol = findCol(ftrHeaders, 'working_days')
  const inactiveReasonCol = findCol(ftrHeaders, 'inactive_reason')

  // Build FTR lookup by rider ID
  const ftrByRider = new Map<string, Record<string, any>>()
  for (const row of ftrRows) {
    if (!ftrRiderIdCol) continue
    const rid = String(row[ftrRiderIdCol] ?? '').trim()
    if (rid) ftrByRider.set(rid, row)
  }

  // ====== Parse WR (finance reconciliation) ======
  let wrRow: Record<string, any> | null = null
  if (wrSheetName) {
    const wrRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wrSheetName], { defval: null })
    if (wrRows.length > 0) {
      wrRow = wrRows[0] // single aggregate row per contract
    }
  }

  // Extract WR aggregate deductions (used as defaults per driver if individual not present)
  let wrCarDeduction = 0
  let wrTgaDeduction = 0
  if (wrRow) {
    const wrHeaders = Object.keys(wrRow)
    const carCol = findCol(wrHeaders, 'car_deduction', 'car deduction')
    const tgaCol = findCol(wrHeaders, 'tga', 'tga 2026')
    if (carCol) wrCarDeduction = num(wrRow[carCol])
    if (tgaCol) wrTgaDeduction = num(wrRow[tgaCol])
  }

  // ====== Join RLVL + FTR by rider ID ======
  const drivers: RawDriverData[] = []
  const seenRiders = new Set<string>()

  for (const row of rlvlRows) {
    const riderId = String(row[riderIdCol!] ?? '').trim()
    if (!riderId) {
      warnings.push(`Skipped RLVL row without rider_id: ${JSON.stringify(row).slice(0, 100)}`)
      continue
    }
    if (seenRiders.has(riderId)) {
      warnings.push(`Duplicate rider_id in RLVL: ${riderId}`)
      continue
    }
    seenRiders.add(riderId)

    const name = nameCol ? String(row[nameCol] ?? '') : ''
    const contractName = contractCol ? String(row[contractCol] ?? 'nokhaba_tatweer_ftr') : 'nokhaba_tatweer_ftr'

    const ftrRow = ftrByRider.get(riderId)
    let vehicleType = 'car'
    let actualWorkingDays = 0
    let fullyWorkingDays = 0
    let workingHours = 0
    let totalMonthlyWorkingHours = 0
    let inactiveReason = 'Active'
    if (ftrRow) {
      if (vehicleCol) vehicleType = String(ftrRow[vehicleCol] ?? 'car')
      if (workingDaysCol) actualWorkingDays = num(ftrRow[workingDaysCol])
      if (fullyWorkingDaysCol) fullyWorkingDays = num(ftrRow[fullyWorkingDaysCol])
      if (workingHoursCol) workingHours = num(ftrRow[workingHoursCol])
      if (totalMonthlyHoursCol) totalMonthlyWorkingHours = num(ftrRow[totalMonthlyHoursCol])
      if (inactiveReasonCol) inactiveReason = String(ftrRow[inactiveReasonCol] ?? 'Active')
    } else {
      warnings.push(`Rider ${riderId} (${name}) found in RLVL but missing in FTR Cost sheet`)
    }

    // Penalties map (raw, may be negative)
    const penalties: Record<string, number> = {
      acceptance_rate_penalties: acceptanceCol ? num(row[acceptanceCol]) : 0,
      contact_rate_penalties: contactCol ? num(row[contactCol]) : 0,
      stacking_deduction: stackingCol ? num(row[stackingCol]) : 0,
      declined_penalties_day_logic: declinedCol ? num(row[declinedCol]) : 0,
      late_penalty: lateCol ? num(row[lateCol]) : 0,
      no_show_penalty: noshowCol ? num(row[noshowCol]) : 0,
      no_show_penalty_special_cities: noshowSpecialCol ? num(row[noshowSpecialCol]) : 0,
      daily_acceptance_rate_penalty: dailyAcceptanceCol ? num(row[dailyAcceptanceCol]) : 0,
      distance_payment: distanceCol ? num(row[distanceCol]) : 0,
      missed_days_penalty: missedDaysCol ? num(row[missedDaysCol]) : 0,
      segment_payment: segmentCol ? num(row[segmentCol]) : 0,
    }

    const riderBalance = riderBalanceCol ? num(row[riderBalanceCol]) : 0

    drivers.push({
      riderId,
      name,
      contractName,
      vehicleType,
      inactiveReason,
      completedOrders: completedOrdersCol ? num(row[completedOrdersCol]) : 0,
      uploadedBasicPayment: basicPaymentCol ? num(row[basicPaymentCol]) : 0,
      uploadedCityPayment: cityPaymentCol ? num(row[cityPaymentCol]) : 0,
      actualWorkingDays,
      fullyWorkingDays,
      workingHours,
      totalMonthlyWorkingHours,
      penalties,
      carDeduction: wrCarDeduction,
      tgaDeduction: wrTgaDeduction,
      riderBalance,
      trafficViolationsTotal: 0, // filled separately by traffic violation lookup
    })
  }

  return {
    drivers,
    wrRow,
    sheetNames,
    warnings,
  }
}
