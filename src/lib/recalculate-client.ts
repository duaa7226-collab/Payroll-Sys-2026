// Client helper — recalculate the latest payroll run and report the real
// outcome. Several views used to fire-and-forget the request and show a
// success toast before the server had answered (and even when it returned 409
// because another calculation was still running).
import { safeFetchJson } from './safe-fetch'

export type RecalculateResult = {
  ok: boolean
  message?: string
  driverCount?: number
  busy?: boolean
}

export async function recalculateLatestRun(): Promise<RecalculateResult> {
  const dashboard = await safeFetchJson('/api/dashboard', null)
  const runId: string | undefined = dashboard?.run?.id
  if (!runId) {
    return { ok: false, message: 'No payroll run to recalculate yet — import a workbook first.' }
  }

  try {
    const resp = await fetch(`/api/recalculate?runId=${runId}`, { method: 'POST' })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return {
        ok: false,
        busy: resp.status === 409,
        message: body?.message || body?.error || `Recalculation failed (HTTP ${resp.status})`,
      }
    }
    return { ok: true, driverCount: body?.driverCount }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Recalculation failed' }
  }
}
