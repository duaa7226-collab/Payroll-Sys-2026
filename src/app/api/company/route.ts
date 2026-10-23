import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/company
export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  let profile = await db.companyProfile.findFirst()
  if (!profile) {
    profile = await db.companyProfile.create({
      data: {
        name: 'Nokhaba Tatweer for Trading',
        nameAr: 'مؤسسة نخبة التطوير للتجارة',
      },
    })
  }
  return NextResponse.json({ profile })
}

// PUT /api/company
export async function PUT(req: NextRequest) {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth({ write: true })
  if (auth instanceof NextResponse) return auth
  const body = await req.json()
  // Whitelist allowed fields to prevent Prisma validation errors
  const allowedFields = [
    'name', 'nameAr', 'logo', 'address', 'addressAr', 'phone', 'email',
    'vatNumber', 'crNumber', 'footerNote', 'footerNoteAr',
    'signatureImg', 'riderSignatureImg', 'stampImg', 'accManagerName',
  ]
  const cleanBody: any = {}
  for (const k of allowedFields) {
    if (k in body) cleanBody[k] = body[k]
  }

  let profile = await db.companyProfile.findFirst()
  if (!profile) {
    profile = await db.companyProfile.create({ data: cleanBody })
  } else {
    profile = await db.companyProfile.update({ where: { id: profile.id }, data: cleanBody })
  }
  await db.auditLog.create({
    data: {
      action: 'company_update',
      entityType: 'company',
      entityId: profile.id,
      description: 'Updated company profile / branding',
    },
  })
  return NextResponse.json({ profile })
}
