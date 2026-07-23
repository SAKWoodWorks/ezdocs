import { NextRequest, NextResponse } from 'next/server'
import { docExists, readMeta, writeMeta } from '@/lib/storage'
import type { SignatureZone, StampZone } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!await docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = await req.json()
  const zones: SignatureZone[] = body.zones
  if (!Array.isArray(zones) || zones.length === 0) {
    return NextResponse.json({ error: 'zones must be a non-empty array' }, { status: 400 })
  }
  for (const z of zones) {
    if (
      typeof z.page !== 'number' || typeof z.x !== 'number' ||
      typeof z.y !== 'number' || typeof z.width !== 'number' ||
      typeof z.height !== 'number' ||
      z.page < 1 || z.x < 0 || z.y < 0 || z.width <= 0 || z.height <= 0
    ) {
      return NextResponse.json({ error: 'Invalid zone coordinates' }, { status: 400 })
    }
  }
  const pages = zones.map(z => z.page)
  if (new Set(pages).size !== pages.length) {
    return NextResponse.json({ error: 'Duplicate page in zones' }, { status: 400 })
  }

  const stampZones: StampZone[] = body.stampZones ?? []
  for (const z of stampZones) {
    if (
      typeof z.page !== 'number' || typeof z.x !== 'number' ||
      typeof z.y !== 'number' || typeof z.width !== 'number' ||
      typeof z.height !== 'number' || typeof z.stampId !== 'string' ||
      z.page < 1 || z.x < 0 || z.y < 0 || z.width <= 0 || z.height <= 0 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(z.stampId)
    ) {
      return NextResponse.json({ error: 'Invalid stamp zone' }, { status: 400 })
    }
  }

  const meta = await readMeta(uuid)
  meta.signatureZones = zones
  meta.stampZones = stampZones
  await writeMeta(uuid, meta)
  return NextResponse.json({ ok: true })
}
