// Single-flight guard for heavy payroll jobs.
//
// Importing a workbook and recalculating a run both rewrite payroll results.
// Running them at the same time used to interleave queries, produce duplicate
// or half-written results, and leave runs stuck in "processing". These jobs are
// now serialized: the second caller receives 409 with a clear message instead
// of silently corrupting the run.
import { NextResponse } from 'next/server'

export const PAYROLL_JOB = 'payroll-write'

type LockEntry = { label: string; startedAt: number; owner: string }

const locks = new Map<string, LockEntry>()

// A crashed process can never release a lock; expire holders after this long so
// a stuck job cannot block payroll forever.
const MAX_HOLD_MS = 10 * 60 * 1000

export type JobLease = { release: () => void; startedAt: number }

export function acquireJob(name: string, label: string): JobLease | { busy: JobLockInfo } {
  const now = Date.now()
  const current = locks.get(name)
  if (current && now - current.startedAt < MAX_HOLD_MS) {
    return { busy: { label: current.label, startedAt: current.startedAt, elapsedMs: now - current.startedAt } }
  }

  const owner = `${now}-${Math.random().toString(36).slice(2, 8)}`
  locks.set(name, { label, startedAt: now, owner })

  let released = false
  return {
    startedAt: now,
    release() {
      if (released) return
      released = true
      if (locks.get(name)?.owner === owner) locks.delete(name)
    },
  }
}

export type JobLockInfo = { label: string; startedAt: number; elapsedMs: number }

/** Run `fn` under an exclusive lock; returns 409 JSON when the job is busy. */
export async function withJobLock<T>(
  name: string,
  label: string,
  fn: (lease: JobLease) => Promise<T>
): Promise<T | NextResponse> {
  const lease = acquireJob(name, label)
  if ('busy' in lease) return busyResponse(lease.busy)
  try {
    return await fn(lease)
  } finally {
    lease.release()
  }
}

export function busyResponse(job: JobLockInfo, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error: 'A payroll calculation is already running',
      message:
        `"${job.label}" started ${Math.max(1, Math.round(job.elapsedMs / 1000))}s ago and is still running. ` +
        'Payroll jobs run one at a time so results stay consistent — please retry when it finishes.',
      busy: true,
      runningJob: job.label,
      runningForMs: job.elapsedMs,
      ...extra,
    },
    { status: 409 }
  )
}
