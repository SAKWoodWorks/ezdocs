import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getDocPath, docExists } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
): Promise<NextResponse> {
  const { uuid } = await params
  if (!docExists(uuid)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const filePath = getDocPath(uuid)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Document not ready' }, { status: 404 })
  }
  const buffer = await fs.promises.readFile(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, no-store',
    },
  })
}
