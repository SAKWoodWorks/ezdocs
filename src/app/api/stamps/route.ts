import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { getStampsDir, getStampPath, ensureStampsDir } from '@/lib/storage'

export async function GET(): Promise<NextResponse> {
  await ensureStampsDir()
  const dir = getStampsDir()
  const files = await fs.promises.readdir(dir)
  const stamps = files
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      id: path.basename(f, '.png'),
      url: `/api/stamps/${path.basename(f, '.png')}`,
    }))
  return NextResponse.json(stamps)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await ensureStampsDir()
  let formData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const file = formData.get('stamp')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    return NextResponse.json({ error: 'Must be PNG or JPG' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 })
  }

  const id = uuidv4()
  const buffer = Buffer.from(await file.arrayBuffer())
  const pngBuffer = await sharp(buffer).png().toBuffer()
  await fs.promises.writeFile(getStampPath(id), pngBuffer)

  return NextResponse.json({ id, url: `/api/stamps/${id}` })
}
