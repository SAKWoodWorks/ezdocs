import { NextRequest, NextResponse } from 'next/server'
import { docExists, readMeta, writeMeta } from '@/lib/storage'
import type { SignatureZone } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json() as Partial<SignatureZone>
  const { page, x, y, width, height } = body

  if (
    typeof page !== 'number' || typeof x !== 'number' ||
    typeof y !== 'number' || typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return NextResponse.json({ error: 'Invalid zone coordinates' }, { status: 400 })
  }

  const meta = readMeta(uuid)
  meta.signatureZone = { page, x, y, width, height }
  writeMeta(uuid, meta)

  return NextResponse.json({ ok: true })
}
