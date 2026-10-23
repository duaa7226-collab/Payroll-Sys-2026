import { NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth'

export async function GET() {
  // Authorization: organization membership + role (owner/admin can write)
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({ message: "Hello, world!" });
}