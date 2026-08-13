import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No payroll run found'); return }
  console.log('Recalculating for run:', run.id, '(', run.payrollMonth, ')')
  const resp = await fetch(`http://localhost:3000/api/recalculate?runId=${run.id}`, { method: 'POST' })
  const text = await resp.text()
  console.log('Status:', resp.status)
  console.log('Response:', text.slice(0, 400))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
