import { NextRequest, NextResponse } from 'next/server'
import { generateManagementReportExcel } from '@/lib/management-report-excel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/management-report?runId=...
// Returns a stunning multi-sheet Excel workbook for management with charts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId') || undefined

    const buffer = await generateManagementReportExcel(runId)
    const fileName = `Management_Report_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('GET /api/management-report failed:', err)
    return NextResponse.json({ error: 'Export failed', message: err?.message }, { status: 500 })
  }
}
