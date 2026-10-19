import { NextRequest, NextResponse } from 'next/server'
import { generateIncomeExpensesExcel } from '@/lib/income-expenses-excel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/income-expenses/export?month=2026-10
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month. Must be YYYY-MM format.' }, { status: 400 })
    }

    const buffer = await generateIncomeExpensesExcel(month)
    const fileName = `Income_vs_Expenses_${month}.xlsx`

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('GET /api/income-expenses/export failed:', err)
    return NextResponse.json({ error: 'Export failed', message: err?.message }, { status: 500 })
  }
}
