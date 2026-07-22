import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDocDir, getDocPath, createMeta } from '@/lib/storage'
import { convertToPdf } from '@/lib/convert'

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '20', 10)
const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']

export async function POST(req: NextRequest): Promise<NextResponse> {
  let uuid: string | null = null
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: `Unsupported file type: ${ext}` }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (buffer.length > MAX_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File exceeds ${MAX_MB}MB limit` }, { status: 413 })
    }

    uuid = uuidv4()
    const docDir = getDocDir(uuid)
    await fs.promises.mkdir(docDir, { recursive: true })

    const originalPath = path.join(docDir, `original${ext}`)
    await fs.promises.writeFile(originalPath, buffer)

    await convertToPdf(originalPath, getDocPath(uuid), ext)
    const safeName = file.name.slice(0, 255).replace(/[^\w\s.-]/g, '_')
    await createMeta(uuid, safeName)

    return NextResponse.json({ uuid })
  } catch (err) {
    if (uuid) {
      const docDir = getDocDir(uuid)
      if (fs.existsSync(docDir)) await fs.promises.rm(docDir, { recursive: true })
    }
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
