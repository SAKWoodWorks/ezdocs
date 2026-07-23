import { NextRequest, NextResponse } from 'next/server'
import { docExists, readMeta } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!await docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const meta = await readMeta(uuid)
  return NextResponse.json({ signed: meta.signed ?? false })
}
