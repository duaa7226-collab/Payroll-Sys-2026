import { db } from '../src/lib/db'

async function main() {
  const run = await db.payrollRun.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!run) { console.log('No run'); return }
  console.log('Recalculating for:', run.payrollMonth)
  const resp = await fetch(`http://localhost:3000/api/recalculate?runId=${run.id}`, { method: 'POST' })
  const text = await resp.text()
  console.log('Status:', resp.status, 'Response:', text.slice(0, 300))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
