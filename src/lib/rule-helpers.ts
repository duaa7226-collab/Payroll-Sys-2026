// Rule helpers — load / save / activate rule sets
import { db } from './db'
import { DEFAULT_RULE_DEFINITIONS, getDefaultRuleMap } from './rules'
import type { RuleSnapshot } from './salary-engine'
import { defaultRuleSnapshot } from './salary-engine'
import { randomUUID } from 'crypto'

// Get the currently active rule set (with values + overrides as a flat snapshot)
export async function getActiveRuleSnapshot(): Promise<{
  ruleSetId: string
  ruleSetName: string
  snapshot: RuleSnapshot
  raw: any
}> {
  let ruleSet = await db.payrollRuleSet.findFirst({
    where: { status: 'active' },
    include: { ruleValues: true, contractOverrides: true },
    orderBy: { activatedAt: 'desc' },
  })
  if (!ruleSet) {
    // Auto-create the default active rule set
    ruleSet = await createDefaultActiveRuleSet()
  }
  const snapshot: RuleSnapshot = {}
  for (const rv of ruleSet.ruleValues) {
    if (rv.valueType === 'numeric') snapshot[rv.ruleKey] = rv.numericValue ?? 0
    else if (rv.valueType === 'boolean') snapshot[rv.ruleKey] = rv.booleanValue ?? false
    else if (rv.valueType === 'json') snapshot[rv.ruleKey] = rv.jsonValue ? JSON.parse(rv.jsonValue) : []
    else snapshot[rv.ruleKey] = rv.textValue ?? ''
  }
  return {
    ruleSetId: ruleSet.id,
    ruleSetName: ruleSet.name,
    snapshot,
    raw: ruleSet,
  }
}

// Create the default active rule set with all default values
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
    },
  })

  // Insert all rule values
  const values = DEFAULT_RULE_DEFINITIONS.map(def => {
    let numericValue: number | null = null
    let textValue: string | null = null
    let booleanValue: boolean | null = null
    let jsonValue: string | null = null
    if (def.valueType === 'numeric') numericValue = typeof def.defaultValue === 'number' ? def.defaultValue : null
    else if (def.valueType === 'boolean') booleanValue = typeof def.defaultValue === 'boolean' ? def.defaultValue : null
    else if (def.valueType === 'json') jsonValue = JSON.stringify(def.defaultValue)
    else textValue = String(def.defaultValue)

    return {
      ruleSetId: ruleSet.id,
      ruleKey: def.key,
      ruleLabel: def.label,
      ruleGroup: def.group,
      valueType: def.valueType,
      numericValue,
      textValue,
      booleanValue,
      jsonValue,
      unit: def.unit ?? null,
      validationMin: def.min ?? null,
      validationMax: def.max ?? null,
      displayOrder: def.displayOrder,
      helpText: def.helpText ?? null,
    }
  })
  // Insert in bulk
  for (const v of values) {
    await db.payrollRuleValue.create({ data: v })
  }

  // Audit log
  await db.auditLog.create({
    data: {
      action: 'rule_activate',
      entityType: 'rule_set',
      entityId: ruleSet.id,
      ruleSetId: ruleSet.id,
      description: 'Default rule set auto-created and activated',
      metadata: JSON.stringify({ ruleMode: 'orders_based_mode' }),
    },
  })

  return db.payrollRuleSet.findUnique({
    where: { id: ruleSet.id },
    include: { ruleValues: true, contractOverrides: true },
  })
}

// Update rule values (creates a new draft if needed, or updates the active)
export async function updateRuleValues(ruleSetId: string, updates: Record<string, number | string | boolean | string[]>) {
  for (const [key, value] of Object.entries(updates)) {
    const existing = await db.payrollRuleValue.findUnique({
      where: { ruleSetId_ruleKey: { ruleSetId, ruleKey: key } },
    })
    if (!existing) continue

    let numericValue = existing.numericValue
    let textValue = existing.textValue
    let booleanValue = existing.booleanValue
    let jsonValue = existing.jsonValue

    if (typeof value === 'number') numericValue = value
    else if (typeof value === 'boolean') booleanValue = value
    else if (Array.isArray(value)) jsonValue = JSON.stringify(value)
    else textValue = String(value)

    await db.payrollRuleValue.update({
      where: { id: existing.id },
      data: { numericValue, textValue, booleanValue, jsonValue },
    })
  }
  await db.payrollRuleSet.update({
    where: { id: ruleSetId },
    data: { updatedBy: 'admin', updatedAt: new Date() },
  })
  await db.auditLog.create({
    data: {
      action: 'rule_edit',
      entityType: 'rule_set',
      entityId: ruleSetId,
      ruleSetId,
      description: `Updated ${Object.keys(updates).length} rule values`,
      metadata: JSON.stringify(Object.keys(updates)),
    },
  })
}

// Build an immutable JSON snapshot for a payroll run
export function buildRuleSnapshotHash(snapshot: RuleSnapshot): string {
  return randomUUID() // simplified — full hash would be sha256 of JSON
}
