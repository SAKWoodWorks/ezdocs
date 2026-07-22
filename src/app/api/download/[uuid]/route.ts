import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getSignedPath, docExists, readMeta } from '@/lib/storage'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const meta = readMeta(uuid)
  if (!meta.signed) {
    return NextResponse.json({ error: 'Document not yet signed' }, { status: 400 })
  }
  const signedPath = getSignedPath(uuid)
  if (!fs.existsSync(signedPath)) {
    return NextResponse.json({ error: 'Signed file missing' }, { status: 404 })
  }
  const buffer = await fs.promises.readFile(signedPath)
  const filename = `signed-${meta.originalName.replace(/\.[^.]+$/, '')}.pdf`
  const preview = req.nextUrl.searchParams.get('preview')
  const disposition = preview ? 'inline' : `attachment; filename="${filename}"`
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': buffer.length.toString(),
    },
  })
}
