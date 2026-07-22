import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { docExists, readMeta, writeMeta, getDocDir, getDocPath, getSignedPath } from '@/lib/storage'
import { embedSignature } from '@/lib/embed-signature'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const meta = readMeta(uuid)
  if (meta.signed) {
    return NextResponse.json({ error: 'Already signed' }, { status: 400 })
  }
  if (!meta.signatureZone) {
    return NextResponse.json({ error: 'No signature zone set' }, { status: 400 })
  }

  let formData
  try {
    formData = await req.formData()
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
  }

  const sigFile = formData.get('signature')
  if (!sigFile || typeof sigFile === 'string') {
    return NextResponse.json({ error: 'No signature image provided' }, { status: 400 })
  }
  if (sigFile.type !== 'image/png') {
    return NextResponse.json({ error: 'Signature must be PNG format' }, { status: 400 })
  }

  const sigBuffer = Buffer.from(await sigFile.arrayBuffer())
  const sigPath = path.join(getDocDir(uuid), 'signature.png')
  await fs.promises.writeFile(sigPath, sigBuffer)

  try {
    await embedSignature(getDocPath(uuid), sigPath, getSignedPath(uuid), meta.signatureZone)
  } catch (err) {
    if (fs.existsSync(sigPath)) await fs.promises.unlink(sigPath)
    console.error('Signature embedding failed:', err)
    return NextResponse.json({ error: 'Failed to embed signature' }, { status: 500 })
  }

  meta.signed = true
  writeMeta(uuid, meta)

  return NextResponse.json({ ok: true })
}
