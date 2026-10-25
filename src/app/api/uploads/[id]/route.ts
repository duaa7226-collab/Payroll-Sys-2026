import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/uploads/[id] — download the archived original workbook
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const file = await db.uploadedFile.findUnique({ where: { id } })
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bytes = new Uint8Array(file.data)
  const asciiName = file.fileName.replace(/[^\w.\- ]+/g, '_').replace(/"/g, '')

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
    },
  })
}

// DELETE /api/uploads/[id] — remove an archived file (explicit action only)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const file = await db.uploadedFile.findUnique({
    where: { id },
    select: { id: true, fileName: true, payrollMonth: true, size: true },
  })
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.uploadedFile.delete({ where: { id } })

  await db.auditLog.create({
    data: {
      action: 'upload_delete',
      entityType: 'uploaded_file',
      entityId: file.id,
      performedBy: auth.email || 'admin',
      description: `Deleted archived workbook ${file.fileName} (${file.payrollMonth})`,
      metadata: JSON.stringify({ fileName: file.fileName, payrollMonth: file.payrollMonth, size: file.size }),
    },
  })

  return NextResponse.json({ success: true, id: file.id })
}
