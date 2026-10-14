import { db } from '../src/lib/db'

async function main() {
  const runs = await db.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, payrollMonth: true, fileName: true, createdAt: true, totalDrivers: true, _count: { select: { results: true } } },
  })
  console.log('=== All Payroll Runs ===')
  for (const r of runs) {
    console.log(`  ${r.payrollMonth} | drivers: ${r._count.results} | file: ${r.fileName} | created: ${r.createdAt.toISOString()}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
