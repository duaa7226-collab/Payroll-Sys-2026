import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getActiveRuleSnapshot, updateRuleValues } from '@/lib/rule-helpers'
import { DEFAULT_RULE_DEFINITIONS, RULE_GROUPS } from '@/lib/rules'

// GET /api/rules — list rule sets, with active one's full values
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const onlyActive = searchParams.get('active') === 'true'

  if (onlyActive) {
    const active = await getActiveRuleSnapshot()
    const ruleSet = await db.payrollRuleSet.findUnique({
      where: { id: active.ruleSetId },
      include: { ruleValues: true, contractOverrides: true },
    })
    return NextResponse.json({
      ruleSetId: active.ruleSetId,
      ruleSetName: active.ruleSetName,
      snapshot: active.snapshot,
      ruleSet,
      groups: RULE_GROUPS,
      definitions: DEFAULT_RULE_DEFINITIONS,
    })
  }

  const ruleSets = await db.payrollRuleSet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { ruleValues: true } } },
  })
  return NextResponse.json({ ruleSets })
}

// PUT /api/rules — update rule values for active rule set
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { ruleSetId, updates } = body as { ruleSetId: string; updates: Record<string, any> }

  if (!ruleSetId || !updates) {
    return NextResponse.json({ error: 'ruleSetId and updates are required' }, { status: 400 })
  }

  await updateRuleValues(ruleSetId, updates)
  return NextResponse.json({ success: true })
}
