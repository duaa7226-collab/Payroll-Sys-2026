import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/drivers?runId=...&search=...&sort=...&band=...&review=...
// GET /api/drivers?all=1  — return ALL drivers from Driver table (not tied to a payroll run)
export async function GET(req: NextRequest) {
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
      case 'orders_asc': results.sort((a, b) => a.completedOrders - a.completedOrders); break
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
