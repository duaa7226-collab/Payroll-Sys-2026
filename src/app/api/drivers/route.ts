import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/drivers?runId=...&search=...&sort=...&band=...&review=...
// GET /api/drivers?all=1  — return ALL drivers from Driver table (not tied to a payroll run)
export async function GET(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')
    const all = searchParams.get('all')
    const search = searchParams.get('search') ?? ''
    const sort = searchParams.get('sort') ?? 'net_desc'
    const band = searchParams.get('band') ?? ''
    const reviewStatus = searchParams.get('review') ?? ''

    // ===== All-drivers mode (for dropdowns in traffic violations, rules, etc.) =====
    if (all === '1' || runId === '') {
      let drivers = await db.driver.findMany({
        orderBy: { name: 'asc' },
      })
      // Filter by search term
      if (search) {
        const q = search.toLowerCase()
        drivers = drivers.filter(d =>
          d.name.toLowerCase().includes(q) ||
          d.riderId.toLowerCase().includes(q) ||
          (d.contractName || '').toLowerCase().includes(q)
        )
      }
      // Return in the same shape as results[] so dropdowns keep working
      const results = drivers.map(d => ({
        id: d.id,
        riderId: d.riderId,
        driverName: d.name,
        name: d.name,
        contractName: d.contractName,
        vehicleType: d.vehicleType,
        beneficiaryName: d.beneficiaryName,
        iban: d.iban,
        bankName: d.bankName,
      }))
      return NextResponse.json({ results, drivers: results })
    }

    // ===== Per-run mode (original behavior) =====
    if (!runId) {
      return NextResponse.json({ error: 'runId required' }, { status: 400 })
    }

    let results = await db.driverResult.findMany({
      where: { payrollRunId: runId },
    })

    // Filter
    if (search) {
      const q = search.toLowerCase()
      results = results.filter(r =>
        r.driverName.toLowerCase().includes(q) ||
        r.riderId.toLowerCase().includes(q) ||
        r.contractName.toLowerCase().includes(q)
      )
    }
    if (band) results = results.filter(r => r.performanceBand === band)
    if (reviewStatus) results = results.filter(r => r.reviewStatus === reviewStatus)

    // Sort
    switch (sort) {
      case 'net_desc': results.sort((a, b) => b.finalNetSalary - a.finalNetSalary); break
      case 'net_asc': results.sort((a, b) => a.finalNetSalary - b.finalNetSalary); break
      case 'orders_desc': results.sort((a, b) => b.completedOrders - a.completedOrders); break
      case 'orders_asc': results.sort((a, b) => a.completedOrders - b.completedOrders); break
      case 'penalty_desc': results.sort((a, b) => b.totalOtherPenalties - a.totalOtherPenalties); break
      case 'name_asc': results.sort((a, b) => a.driverName.localeCompare(b.driverName)); break
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    console.error('GET /api/drivers failed:', err)
    return NextResponse.json({ error: 'Failed', message: err?.message, results: [] }, { status: 500 })
  }
}

// POST /api/drivers — create a new driver manually
export async function POST(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { riderId, name, contractName, vehicleType, bankName, iban, beneficiaryName } = body

    if (!riderId || !name) {
      return NextResponse.json({ error: 'riderId and name are required' }, { status: 400 })
    }

    // Check for duplicate riderId
    const existing = await db.driver.findUnique({ where: { riderId: String(riderId) } })
    if (existing) {
      return NextResponse.json({ error: `Driver with rider ID '${riderId}' already exists` }, { status: 409 })
    }

    const driver = await db.driver.create({
      data: {
        riderId: String(riderId),
        name: String(name),
        contractName: contractName || 'nokhaba_tatweer_ftr',
        vehicleType: vehicleType || 'car',
        bankName: bankName || null,
        iban: iban || null,
        beneficiaryName: beneficiaryName || null,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'driver_create',
        entityType: 'driver',
        entityId: driver.id,
        description: `Created driver ${name} (${riderId})`,
        metadata: JSON.stringify({ riderId, name, contractName, vehicleType, bankName, iban, beneficiaryName }),
      },
    })

    return NextResponse.json({ driver })
  } catch (err: any) {
    console.error('POST /api/drivers failed:', err)
    return NextResponse.json({ error: 'Create failed', message: err?.message }, { status: 500 })
  }
}

// PUT /api/drivers — update an existing driver
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { id, riderId, name, contractName, vehicleType, bankName, iban, beneficiaryName } = body

    if (!id && !riderId) {
      return NextResponse.json({ error: 'id or riderId required' }, { status: 400 })
    }

    // Find the driver
    let driver = id
      ? await db.driver.findUnique({ where: { id } })
      : await db.driver.findUnique({ where: { riderId: String(riderId) } })

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }

    // If riderId is being changed, check for duplicates
    if (riderId && riderId !== driver.riderId) {
      const dup = await db.driver.findUnique({ where: { riderId: String(riderId) } })
      if (dup && dup.id !== driver.id) {
        return NextResponse.json({ error: `Driver with rider ID '${riderId}' already exists` }, { status: 409 })
      }
    }

    const updated = await db.driver.update({
      where: { id: driver.id },
      data: {
        riderId: riderId !== undefined ? String(riderId) : undefined,
        name: name !== undefined ? String(name) : undefined,
        contractName: contractName !== undefined ? String(contractName) : undefined,
        vehicleType: vehicleType !== undefined ? String(vehicleType) : undefined,
        bankName: bankName !== undefined ? (bankName || null) : undefined,
        iban: iban !== undefined ? (iban || null) : undefined,
        beneficiaryName: beneficiaryName !== undefined ? (beneficiaryName || null) : undefined,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'driver_update',
        entityType: 'driver',
        entityId: updated.id,
        description: `Updated driver ${updated.name} (${updated.riderId})`,
        metadata: JSON.stringify({ riderId, name, contractName, vehicleType, bankName, iban, beneficiaryName }),
      },
    })

    return NextResponse.json({ driver: updated })
  } catch (err: any) {
    console.error('PUT /api/drivers failed:', err)
    return NextResponse.json({ error: 'Update failed', message: err?.message }, { status: 500 })
  }
}

// DELETE /api/drivers?id=... — delete a driver
export async function DELETE(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const driver = await db.driver.findUnique({ where: { id } })
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    await db.driver.delete({ where: { id } })

    await db.auditLog.create({
      data: {
        action: 'driver_delete',
        entityType: 'driver',
        entityId: id,
        description: `Deleted driver ${driver.name} (${driver.riderId})`,
        metadata: JSON.stringify({ riderId: driver.riderId, name: driver.name }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('DELETE /api/drivers failed:', err)
    return NextResponse.json({ error: 'Delete failed', message: err?.message }, { status: 500 })
  }
}

// PATCH /api/drivers — update a single DriverResult field (inline edit)
// Body: { id: "resultId", field: "actualWorkingDays", value: 30 }
// Triggers instant recalculation of that driver's salary
export async function PATCH(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json()
    const { id, field, value } = body

    if (!id || !field) {
      return NextResponse.json({ error: 'id and field required' }, { status: 400 })
    }

    // Allowed editable fields on DriverResult
    const EDITABLE_FIELDS: Record<string, string> = {
      actualWorkingDays: 'actualWorkingDays',
      fullyWorkingDays: 'fullyWorkingDays',
      workingHours: 'workingHours',
      totalMonthlyWorkingHours: 'totalMonthlyWorkingHours',
      completedOrders: 'completedOrders',
      inactiveReason: 'inactiveReason',
      vehicleType: 'vehicleType',
    }

    const dbField = EDITABLE_FIELDS[field]
    if (!dbField) {
      return NextResponse.json({ error: `Field "${field}" is not editable. Editable: ${Object.keys(EDITABLE_FIELDS).join(', ')}` }, { status: 400 })
    }

    // Fetch the existing result
    const existing = await db.driverResult.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Result not found' }, { status: 404 })

    // Parse value
    let parsedValue: any = value
    if (typeof value === 'string') {
      if (field === 'inactiveReason' || field === 'vehicleType') {
        parsedValue = value
      } else {
        parsedValue = parseFloat(value)
        if (isNaN(parsedValue)) return NextResponse.json({ error: 'Invalid numeric value' }, { status: 400 })
        if (field === 'completedOrders') parsedValue = Math.round(parsedValue)
      }
    }

    // Update the field
    const updated = await db.driverResult.update({
      where: { id },
      data: { [dbField]: parsedValue },
    })

    // ====== Recalculate this driver's salary on the fly ======
    // Uses the exact same input reconstruction as full recalculation, so a
    // single-row edit can never produce different numbers than a full run.
    const { calculateDriverSalary } = await import('@/lib/salary-engine')
    const { getActiveRuleSnapshot } = await import('@/lib/rule-helpers')
    const { getAllRiderTrafficDeductions } = await import('@/lib/traffic-helpers')
    const { getAllRiderManualAdjustments } = await import('@/lib/manual-adjustment-helpers')
    const { getActiveCustomBonuses, getBonusesForRider } = await import('@/lib/custom-bonus-helpers')
    const { getActiveCustomDeductions, getDeductionsForRider } = await import('@/lib/custom-deduction-helpers')
    const { buildRawFromResult } = await import('@/lib/payroll-persist')

    const activeRules = await getActiveRuleSnapshot()
    const [trafficByRider, manualByRider, customBonuses, customDeductions] = await Promise.all([
      getAllRiderTrafficDeductions([existing.riderId]),
      getAllRiderManualAdjustments([existing.riderId]),
      getActiveCustomBonuses(),
      getActiveCustomDeductions(),
    ])

    const raw = buildRawFromResult(updated, {
      trafficByRider,
      manualByRider,
      customBonuses,
      customDeductions,
      riderBonuses: (riderId: string) =>
        getBonusesForRider(customBonuses, riderId).map(b => ({ name: b.name, nameAr: b.nameAr, amount: b.amount })),
      riderDeductions: (riderId: string) =>
        getDeductionsForRider(customDeductions, riderId).map(d => ({
          name: d.name, nameAr: d.nameAr, amount: d.amount, monthlyDeduction: d.monthlyDeduction,
        })),
    })

    const result = calculateDriverSalary(raw, activeRules.snapshot, activeRules.ruleSetName, updated.payrollMonth)

    // Save recalculated result
    const recalculated = await db.driverResult.update({
      where: { id },
      data: {
        completedOrders: result.completedOrders,
        actualWorkingDays: result.actualWorkingDays,
        fullyWorkingDays: result.fullyWorkingDays,
        workingHours: result.workingHours,
        totalMonthlyWorkingHours: result.totalMonthlyWorkingHours,
        inactiveReason: result.inactiveReason,
        vehicleType: result.vehicleType,
        dailyBaseRate: result.dailyBaseRate,
        adjustedBaseSalary: result.adjustedBaseSalary,
        adjustedTargetOrders: result.adjustedTargetOrders,
        selectedTargetThreshold: result.selectedTargetThreshold,
        baseSalaryEquivalent: result.baseSalaryEquivalent,
        extraOrders: result.extraOrders,
        missingOrders: result.missingOrders,
        bonusAmount: result.bonusAmount,
        missingOrderDeduction: result.missingOrderDeduction,
        penaltiesJson: JSON.stringify(result.penalties),
        totalOtherPenalties: result.totalOtherPenalties,
        trafficViolationsDeduction: result.trafficViolationsDeduction,
        grossSalaryBeforePenalties: result.grossSalaryBeforePenalties,
        finalNetSalary: result.finalNetSalary,
        varianceAmount: result.varianceAmount,
        variancePercentage: result.variancePercentage,
        varianceStatus: result.varianceStatus,
        reviewStatus: result.reviewStatus,
        exceptionFlag: result.exceptionFlag,
        performanceBand: result.performanceBand,
      },
    })

    return NextResponse.json({
      success: true,
      field,
      oldValue: (existing as any)[dbField],
      newValue: parsedValue,
      result: recalculated,
    })
  } catch (err: any) {
    console.error('PATCH /api/drivers failed:', err)
    return NextResponse.json({ error: 'Update failed', message: err?.message }, { status: 500 })
  }
}
