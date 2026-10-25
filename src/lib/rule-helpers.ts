// Rule helpers — load / save / activate rule sets
//
// Every calculation path (import, recalculation, dashboard, single-driver edit)
// goes through getActiveRuleSnapshot(), which guarantees that the active rule
// set contains a row for EVERY rule defined in RULE_DEFINITIONS. Missing rules
// are backfilled with their defaults in one bulk insert, so the Rules Control
// Center is complete the very first time it is opened or an Excel is imported.
import { db } from './db'
import { DEFAULT_RULE_DEFINITIONS, getDefaultRuleMap, type RuleDefinition } from './rules'
import type { RuleSnapshot } from './salary-engine'
import { randomUUID } from 'crypto'

type RuleValueColumns = {
  numericValue: number | null
  textValue: string | null
  booleanValue: boolean | null
  jsonValue: string | null
}

/** Convert a rule definition (+ optional value) into the typed columns stored in DB. */
function valueColumns(def: RuleDefinition, value?: unknown): RuleValueColumns {
  const v = value === undefined ? def.defaultValue : value
  const columns: RuleValueColumns = { numericValue: null, textValue: null, booleanValue: null, jsonValue: null }

  switch (def.valueType) {
    case 'numeric': {
      const parsed = typeof v === 'number' ? v : parseFloat(String(v))
      const fallback = typeof def.defaultValue === 'number' ? def.defaultValue : 0
      columns.numericValue = Number.isFinite(parsed) ? parsed : fallback
      break
    }
    case 'boolean':
      columns.booleanValue = v === true || v === 'true'
      break
    case 'json':
      columns.jsonValue = JSON.stringify(v ?? def.defaultValue ?? [])
      break
    default:
      columns.textValue = String(v ?? def.defaultValue ?? '')
  }
  return columns
}

/** Metadata + value columns for a rule value row (ruleSetId added by the caller). */
function ruleValueFields(def: RuleDefinition, value?: unknown) {
  return {
    ruleKey: def.key,
    ruleLabel: def.label,
    ruleGroup: def.group,
    valueType: def.valueType,
    unit: def.unit ?? null,
    validationMin: def.min ?? null,
    validationMax: def.max ?? null,
    displayOrder: def.displayOrder,
    helpText: def.helpText ?? null,
    ...valueColumns(def, value),
  }
}

function ruleValueRow(ruleSetId: string, def: RuleDefinition, value?: unknown) {
  return { ruleSetId, ...ruleValueFields(def, value) }
}

const DEFINITIONS_BY_KEY = new Map(DEFAULT_RULE_DEFINITIONS.map(def => [def.key, def]))

// Dedupe concurrent bootstraps inside this process (e.g. dashboard + import
// firing at the same time on a fresh deployment) so only one default rule set
// is ever created.
let activeRuleSetPromise: Promise<any> | null = null

/**
 * Ensure an active rule set exists and that it holds every defined rule.
 * Safe to call concurrently and repeatedly — it never overwrites values that
 * an administrator has already configured.
 */
export async function ensureActiveRuleSet(): Promise<{ ruleSet: any; addedRuleCount: number; created: boolean }> {
  if (!activeRuleSetPromise) {
    activeRuleSetPromise = ensureActiveRuleSetInner().finally(() => {
      activeRuleSetPromise = null
    })
  }
  return activeRuleSetPromise
}

async function ensureActiveRuleSetInner() {
  let ruleSet = await db.payrollRuleSet.findFirst({
    where: { status: 'active' },
    orderBy: [{ activatedAt: 'desc' }, { createdAt: 'desc' }],
    include: { ruleValues: true, contractOverrides: true },
  })

  let created = false
  if (!ruleSet) {
    const bootstrap = await db.$transaction(async tx => {
      // Re-check inside the transaction: another request may have created it
      // between our read and this write.
      const raced = await tx.payrollRuleSet.findFirst({
        where: { status: 'active' },
        orderBy: [{ activatedAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      })
      if (raced) return { id: raced.id, created: false }

      const createdRuleSet = await tx.payrollRuleSet.create({
        data: {
          name: 'Default 2026 Rule Set',
          status: 'active',
          ruleMode: 'orders_based_mode',
          currency: 'SAR',
          notes: 'Initial default rule set — orders-based mode, base 2000 SAR, target 450 orders',
          createdBy: 'system',
          activatedBy: 'system',
          activatedAt: new Date(),
          effectiveFrom: new Date(),
          ruleValues: { create: DEFAULT_RULE_DEFINITIONS.map(def => ruleValueFields(def)) },
        },
        select: { id: true },
      })
      return { id: createdRuleSet.id, created: true }
    })
    created = bootstrap.created
    ruleSet = await db.payrollRuleSet.findUnique({
      where: { id: bootstrap.id },
      include: { ruleValues: true, contractOverrides: true },
    })
    if (!ruleSet) throw new Error('Failed to bootstrap the default rule set')
  }

  const existingKeys = new Set(ruleSet.ruleValues.map((rv: any) => rv.ruleKey))
  const missing = DEFAULT_RULE_DEFINITIONS.filter(def => !existingKeys.has(def.key))

  if (missing.length > 0) {
    // One bulk insert for all missing rules (new rules added to the app after
    // this deployment), so the Control Center is instantly complete.
    await db.payrollRuleValue.createMany({
      data: missing.map(def => ruleValueRow(ruleSet!.id, def)),
      skipDuplicates: true,
    })
    ruleSet = await db.payrollRuleSet.findUnique({
      where: { id: ruleSet.id },
      include: { ruleValues: true, contractOverrides: true },
    })
  }

  if (created) {
    await safeAudit({
      action: 'rule_activate',
      entityType: 'rule_set',
      entityId: ruleSet!.id,
      ruleSetId: ruleSet!.id,
      description: `Default rule set created and activated with all ${DEFAULT_RULE_DEFINITIONS.length} rules`,
      metadata: JSON.stringify({ ruleMode: 'orders_based_mode', ruleCount: DEFAULT_RULE_DEFINITIONS.length }),
    })
  } else if (missing.length > 0) {
    await safeAudit({
      action: 'rule_edit',
      entityType: 'rule_set',
      entityId: ruleSet!.id,
      ruleSetId: ruleSet!.id,
      description: `Added ${missing.length} missing rule(s) to the active rule set`,
      metadata: JSON.stringify(missing.map(def => def.key)),
    })
  }

  return { ruleSet, addedRuleCount: missing.length, created }
}

async function safeAudit(data: any) {
  try {
    await db.auditLog.create({ data: { performedBy: 'system', ...data } })
  } catch (e) {
    // Auditing must never block payroll computation.
    console.warn('Rule audit log write failed:', e)
  }
}

/** Insert any rules missing from a specific rule set. Returns the number added. */
export async function backfillRuleValues(ruleSetId: string): Promise<number> {
  const existing = await db.payrollRuleValue.findMany({
    where: { ruleSetId },
    select: { ruleKey: true },
  })
  const keys = new Set(existing.map(v => v.ruleKey))
  const missing = DEFAULT_RULE_DEFINITIONS.filter(def => !keys.has(def.key))
  if (missing.length === 0) return 0

  await db.payrollRuleValue.createMany({
    data: missing.map(def => ruleValueRow(ruleSetId, def)),
    skipDuplicates: true,
  })
  return missing.length
}

// Get the currently active rule set (with values + overrides as a flat snapshot)
export async function getActiveRuleSnapshot(): Promise<{
  ruleSetId: string
  ruleSetName: string
  snapshot: RuleSnapshot
  raw: any
  ruleCount: number
  addedRuleCount: number
  createdRuleSet: boolean
}> {
  const { ruleSet, addedRuleCount, created } = await ensureActiveRuleSet()

  // Start from defaults so a missing row can never silently fall back to a
  // hardcoded number inside the salary engine.
  const snapshot: RuleSnapshot = getDefaultRuleMap() as RuleSnapshot
  for (const rv of ruleSet.ruleValues) {
    if (rv.valueType === 'numeric') snapshot[rv.ruleKey] = rv.numericValue ?? 0
    else if (rv.valueType === 'boolean') snapshot[rv.ruleKey] = rv.booleanValue ?? false
    else if (rv.valueType === 'json') {
      try {
        snapshot[rv.ruleKey] = rv.jsonValue ? JSON.parse(rv.jsonValue) : []
      } catch {
        snapshot[rv.ruleKey] = []
      }
    }
    else snapshot[rv.ruleKey] = rv.textValue ?? ''
  }

  return {
    ruleSetId: ruleSet.id,
    ruleSetName: ruleSet.name,
    snapshot,
    raw: ruleSet,
    ruleCount: ruleSet.ruleValues.length,
    addedRuleCount,
    createdRuleSet: created,
  }
}

// Create the default active rule set with all default values (kept for callers
// that explicitly want a fresh set, e.g. seeding).
export async function createDefaultActiveRuleSet() {
  const ruleSet = await db.payrollRuleSet.create({
    data: {
      name: 'Default 2026 Rule Set',
      status: 'active',
      ruleMode: 'orders_based_mode',
      currency: 'SAR',
      notes: 'Initial default rule set — Orders-Based mode, base 2000 SAR, target 450 orders',
      createdBy: 'system',
      activatedBy: 'system',
      activatedAt: new Date(),
      effectiveFrom: new Date(),
      // One nested write instead of ~45 sequential round-trips.
      ruleValues: { create: DEFAULT_RULE_DEFINITIONS.map(def => ruleValueFields(def)) },
    },
    include: { ruleValues: true, contractOverrides: true },
  })

  await safeAudit({
    action: 'rule_activate',
    entityType: 'rule_set',
    entityId: ruleSet.id,
    ruleSetId: ruleSet.id,
    description: `Default rule set created and activated with ${DEFAULT_RULE_DEFINITIONS.length} rules`,
    metadata: JSON.stringify({ ruleMode: 'orders_based_mode' }),
  })

  return ruleSet
}

// Update rule values — upserts so newly added rule keys can be saved too.
export async function updateRuleValues(ruleSetId: string, updates: Record<string, number | string | boolean | string[]>) {
  const entries = Object.entries(updates).filter(([key]) => DEFINITIONS_BY_KEY.has(key))
  if (entries.length === 0) return 0

  await db.$transaction(async tx => {
    for (const [key, value] of entries) {
      const def = DEFINITIONS_BY_KEY.get(key)!
      const valueData = valueColumns(def, value)
      await tx.payrollRuleValue.upsert({
        where: { ruleSetId_ruleKey: { ruleSetId, ruleKey: key } },
        create: { ruleSetId, ...ruleValueFields(def, value) },
        update: valueData,
      })
    }
    await tx.payrollRuleSet.update({
      where: { id: ruleSetId },
      data: { updatedBy: 'admin' },
    })
  })

  await safeAudit({
    action: 'rule_edit',
    entityType: 'rule_set',
    entityId: ruleSetId,
    ruleSetId,
    description: `Updated ${entries.length} rule values`,
    metadata: JSON.stringify(entries.map(([key]) => key)),
  })

  return entries.length
}

// Build an immutable JSON snapshot for a payroll run
export function buildRuleSnapshotHash(snapshot: RuleSnapshot): string {
  return randomUUID() // simplified — full hash would be sha256 of JSON
}
