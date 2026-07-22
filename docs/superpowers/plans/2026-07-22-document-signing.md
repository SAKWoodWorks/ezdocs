# Document Signing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js app where users upload documents, place a signature zone, share a link, and managers sign with mouse — producing a downloadable signed PDF.

**Architecture:** No database, no auth. Each document gets a UUID folder on the filesystem with `document.pdf`, `signed.pdf`, and `meta.json`. UUID is the only reference — it IS the link. Cleanup cron deletes folders older than 7 days.

**Tech Stack:** Next.js 14 App Router, TypeScript, pdf-lib, libreoffice-convert, sharp, react-pdf, react-signature-canvas, react-draggable, multer, node-cron, uuid, Jest, @testing-library/react

---

## File Map

```
src/
  app/
    page.tsx                        — Upload page (/)
    prepare/[uuid]/page.tsx         — Place signature zone, show shareable link
    sign/[uuid]/page.tsx            — View PDF, draw signature, download
    not-found.tsx                   — 404 "Link expired or invalid"
    api/
      upload/route.ts               — POST: receive file, convert, save, return UUID
      doc/[uuid]/route.ts           — GET: stream document.pdf
      prepare/[uuid]/route.ts       — POST: save signatureZone to meta.json
      sign/[uuid]/route.ts          — POST: embed signature, save signed.pdf
      download/[uuid]/route.ts      — GET: stream signed.pdf
  lib/
    types.ts                        — Shared TS types (Meta, SignatureZone)
    storage.ts                      — File paths, read/write meta.json
    convert.ts                      — DOCX/image → PDF conversion
    embed-signature.ts              — pdf-lib: embed PNG into PDF at coordinates
    cleanup.ts                      — node-cron: delete expired folders
  components/
    UploadZone.tsx                  — Drag-and-drop file upload UI
    PdfViewer.tsx                   — react-pdf wrapper (single page)
    SignaturePad.tsx                — react-signature-canvas wrapper
    SignatureZoneDragger.tsx        — Draggable yellow box overlay on PDF
.env.local                         — UPLOAD_DIR, BASE_URL, MAX_FILE_SIZE_MB
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `.env.local`, `.env.example`, `.gitignore`, `next.config.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd D:/Works/Web/documents-system
npx create-next-app@latest . --typescript --app --no-tailwind --eslint --src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install pdf-lib libreoffice-convert sharp react-signature-canvas react-pdf react-draggable multer node-cron uuid
npm install --save-dev @types/multer @types/node-cron @types/uuid jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest
```

- [ ] **Step 3: Create .env.local**

```bash
cat > .env.local << 'EOF'
UPLOAD_DIR=/var/www/documents-system/uploads
BASE_URL=http://localhost:3000
MAX_FILE_SIZE_MB=20
EOF
```

- [ ] **Step 4: Create .env.example**

```bash
cat > .env.example << 'EOF'
UPLOAD_DIR=/var/www/documents-system/uploads
BASE_URL=https://yourdomain.com
MAX_FILE_SIZE_MB=20
EOF
```

- [ ] **Step 5: Add to .gitignore**

Append to `.gitignore`:
```
.env.local
uploads/
```

- [ ] **Step 6: Configure Jest — create jest.config.ts**

```typescript
import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathPattern: ['<rootDir>/src/**/*.test.ts'],
}

export default config
```

- [ ] **Step 7: Add test script to package.json**

In `package.json` scripts add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 8: Create uploads dir and verify Next.js starts**

```bash
mkdir -p uploads
npm run dev
```

Expected: `✓ Ready on http://localhost:3000`

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with deps and jest config"
```

---

## Task 2: Shared Types and Storage Library

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/storage.ts`
- Create: `src/lib/storage.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// src/lib/types.ts
export interface SignatureZone {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface Meta {
  createdAt: string
  expiresAt: string
  originalName: string
  signed: boolean
  signatureZone: SignatureZone | null
}
```

- [ ] **Step 2: Write failing tests for storage.ts**

```typescript
// src/lib/storage.test.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDocDir, getDocPath, getMetaPath, readMeta, writeMeta, createMeta } from '@/lib/storage'
import type { Meta } from '@/lib/types'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsign-'))
  process.env.UPLOAD_DIR = tmpDir
})

afterEach(() => fs.rmSync(tmpDir, { recursive: true }))

test('getDocDir returns path inside UPLOAD_DIR', () => {
  expect(getDocDir('abc123')).toBe(path.join(tmpDir, 'abc123'))
})

test('getDocPath returns document.pdf path', () => {
  expect(getDocPath('abc123')).toBe(path.join(tmpDir, 'abc123', 'document.pdf'))
})

test('getMetaPath returns meta.json path', () => {
  expect(getMetaPath('abc123')).toBe(path.join(tmpDir, 'abc123', 'meta.json'))
})

test('writeMeta and readMeta round-trip', () => {
  const uuid = 'test-uuid'
  fs.mkdirSync(path.join(tmpDir, uuid))
  const meta: Meta = {
    createdAt: '2026-07-22T00:00:00Z',
    expiresAt: '2026-07-29T00:00:00Z',
    originalName: 'file.pdf',
    signed: false,
    signatureZone: null,
  }
  writeMeta(uuid, meta)
  expect(readMeta(uuid)).toEqual(meta)
})

test('createMeta writes initial meta with null signatureZone', () => {
  const uuid = 'new-uuid'
  fs.mkdirSync(path.join(tmpDir, uuid))
  createMeta(uuid, 'contract.pdf')
  const meta = readMeta(uuid)
  expect(meta.signed).toBe(false)
  expect(meta.signatureZone).toBeNull()
  expect(meta.originalName).toBe('contract.pdf')
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- storage.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/storage'`

- [ ] **Step 4: Write storage.ts**

```typescript
// src/lib/storage.ts
import fs from 'fs'
import path from 'path'
import type { Meta } from '@/lib/types'

function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR
  if (!dir) throw new Error('UPLOAD_DIR env var not set')
  return dir
}

export function getDocDir(uuid: string): string {
  return path.join(uploadDir(), uuid)
}

export function getDocPath(uuid: string): string {
  return path.join(getDocDir(uuid), 'document.pdf')
}

export function getSignedPath(uuid: string): string {
  return path.join(getDocDir(uuid), 'signed.pdf')
}

export function getMetaPath(uuid: string): string {
  return path.join(getDocDir(uuid), 'meta.json')
}

export function readMeta(uuid: string): Meta {
  return JSON.parse(fs.readFileSync(getMetaPath(uuid), 'utf-8'))
}

export function writeMeta(uuid: string, meta: Meta): void {
  fs.writeFileSync(getMetaPath(uuid), JSON.stringify(meta, null, 2))
}

export function createMeta(uuid: string, originalName: string): Meta {
  const now = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + 7)
  const meta: Meta = {
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    originalName,
    signed: false,
    signatureZone: null,
  }
  writeMeta(uuid, meta)
  return meta
}

export function docExists(uuid: string): boolean {
  return fs.existsSync(getDocDir(uuid))
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- storage.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add types and storage lib"
```

---

## Task 3: File Conversion Library

**Files:**
- Create: `src/lib/convert.ts`
- Create: `src/lib/convert.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/convert.test.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { convertToPdf } from '@/lib/convert'

let tmpDir: string
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-')) })
afterEach(() => fs.rmSync(tmpDir, { recursive: true }))

test('convertToPdf copies .pdf unchanged', async () => {
  // minimal valid PDF bytes
  const pdfBytes = Buffer.from('%PDF-1.4\n%%EOF\n')
  const src = path.join(tmpDir, 'input.pdf')
  const dest = path.join(tmpDir, 'document.pdf')
  fs.writeFileSync(src, pdfBytes)
  await convertToPdf(src, dest, '.pdf')
  expect(fs.existsSync(dest)).toBe(true)
  expect(fs.readFileSync(dest)).toEqual(pdfBytes)
})

test('convertToPdf converts .jpg to pdf using sharp', async () => {
  // create a 1x1 white JPEG with sharp
  const sharp = require('sharp')
  const src = path.join(tmpDir, 'image.jpg')
  await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .jpeg().toFile(src)
  const dest = path.join(tmpDir, 'document.pdf')
  await convertToPdf(src, dest, '.jpg')
  expect(fs.existsSync(dest)).toBe(true)
  const bytes = fs.readFileSync(dest)
  expect(bytes.slice(0, 4).toString()).toBe('%PDF')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- convert.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/convert'`

- [ ] **Step 3: Write convert.ts**

```typescript
// src/lib/convert.ts
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

export async function convertToPdf(srcPath: string, destPath: string, ext: string): Promise<void> {
  const normalizedExt = ext.toLowerCase()

  if (normalizedExt === '.pdf') {
    fs.copyFileSync(srcPath, destPath)
    return
  }

  if (normalizedExt === '.jpg' || normalizedExt === '.jpeg' || normalizedExt === '.png') {
    await convertImageToPdf(srcPath, destPath)
    return
  }

  if (normalizedExt === '.docx' || normalizedExt === '.doc') {
    await convertDocxToPdf(srcPath, destPath)
    return
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

async function convertImageToPdf(srcPath: string, destPath: string): Promise<void> {
  const imgBuffer = await sharp(srcPath).png().toBuffer()
  const { width, height } = await sharp(srcPath).metadata()
  if (!width || !height) throw new Error('Cannot read image dimensions')

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])
  const img = await pdfDoc.embedPng(imgBuffer)
  page.drawImage(img, { x: 0, y: 0, width, height })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(destPath, pdfBytes)
}

async function convertDocxToPdf(srcPath: string, destPath: string): Promise<void> {
  // libreoffice-convert uses callbacks — promisify
  const libreoffice = await import('libreoffice-convert')
  const convert = libreoffice.default?.convert ?? libreoffice.convert

  const inputBuffer = fs.readFileSync(srcPath)
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    convert(inputBuffer, '.pdf', undefined, (err: Error | null, result: Buffer) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
  fs.writeFileSync(destPath, pdfBuffer)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- convert.test.ts
```

Expected: PASS (2 tests). Note: DOCX test not included — requires LibreOffice on machine.

- [ ] **Step 5: Commit**

```bash
git add src/lib/convert.ts src/lib/convert.test.ts
git commit -m "feat: add file conversion lib (PDF passthrough, image-to-PDF, DOCX-to-PDF)"
```

---

## Task 4: Signature Embedding Library

**Files:**
- Create: `src/lib/embed-signature.ts`
- Create: `src/lib/embed-signature.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/embed-signature.test.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PDFDocument } from 'pdf-lib'
import { embedSignature } from '@/lib/embed-signature'
import type { SignatureZone } from '@/lib/types'

let tmpDir: string
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-')) })
afterEach(() => fs.rmSync(tmpDir, { recursive: true }))

async function makePdf(): Promise<string> {
  const doc = await PDFDocument.create()
  doc.addPage([595, 842]) // A4
  const bytes = await doc.save()
  const p = path.join(tmpDir, 'doc.pdf')
  fs.writeFileSync(p, bytes)
  return p
}

async function makePngSignature(): Promise<string> {
  const sharp = require('sharp')
  const p = path.join(tmpDir, 'sig.png')
  await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png().toFile(p)
  return p
}

test('embedSignature produces a valid PDF larger than input', async () => {
  const docPath = await makePdf()
  const sigPath = await makePngSignature()
  const outPath = path.join(tmpDir, 'signed.pdf')
  const zone: SignatureZone = { page: 1, x: 100, y: 100, width: 200, height: 80 }

  await embedSignature(docPath, sigPath, outPath, zone)

  expect(fs.existsSync(outPath)).toBe(true)
  const bytes = fs.readFileSync(outPath)
  expect(bytes.slice(0, 4).toString()).toBe('%PDF')
  expect(bytes.length).toBeGreaterThan(fs.statSync(docPath).size)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- embed-signature.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/embed-signature'`

- [ ] **Step 3: Write embed-signature.ts**

```typescript
// src/lib/embed-signature.ts
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import type { SignatureZone } from '@/lib/types'

export async function embedSignature(
  docPath: string,
  signaturePngPath: string,
  outputPath: string,
  zone: SignatureZone,
): Promise<void> {
  const pdfBytes = fs.readFileSync(docPath)
  const sigBytes = fs.readFileSync(signaturePngPath)

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const sigImage = await pdfDoc.embedPng(sigBytes)

  const pages = pdfDoc.getPages()
  // zone.page is 1-indexed
  const pageIndex = Math.max(0, Math.min(zone.page - 1, pages.length - 1))
  const page = pages[pageIndex]
  const { height: pageHeight } = page.getSize()

  // pdf-lib origin is bottom-left; zone coords are top-left origin
  const pdfY = pageHeight - zone.y - zone.height

  page.drawImage(sigImage, {
    x: zone.x,
    y: pdfY,
    width: zone.width,
    height: zone.height,
  })

  const signedBytes = await pdfDoc.save()
  fs.writeFileSync(outputPath, signedBytes)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- embed-signature.test.ts
```

Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/embed-signature.ts src/lib/embed-signature.test.ts
git commit -m "feat: add signature embedding lib with coordinate flip for pdf-lib"
```

---

## Task 5: POST /api/upload

**Files:**
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Write route.ts**

```typescript
// src/app/api/upload/route.ts
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
    fs.mkdirSync(docDir, { recursive: true })

    const originalPath = path.join(docDir, `original${ext}`)
    fs.writeFileSync(originalPath, buffer)

    await convertToPdf(originalPath, getDocPath(uuid), ext)
    createMeta(uuid, file.name)

    return NextResponse.json({ uuid })
  } catch (err) {
    if (uuid) {
      const docDir = getDocDir(uuid)
      if (fs.existsSync(docDir)) fs.rmSync(docDir, { recursive: true })
    }
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Manual test — start dev server and upload a PDF**

```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/test.pdf" | jq
```

Expected: `{ "uuid": "some-uuid-value" }`
Verify: `uploads/<uuid>/document.pdf` and `meta.json` exist

- [ ] **Step 3: Test file too large rejection**

```bash
# Create a 21MB dummy file
dd if=/dev/zero bs=1M count=21 > /tmp/big.pdf
curl -X POST http://localhost:3000/api/upload -F "file=@/tmp/big.pdf"
```

Expected: `{"error":"File exceeds 20MB limit"}` with status 413

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: POST /api/upload — save file and convert to PDF"
```

---

## Task 6: GET /api/doc/[uuid] and GET /api/download/[uuid]

**Files:**
- Create: `src/app/api/doc/[uuid]/route.ts`
- Create: `src/app/api/download/[uuid]/route.ts`

- [ ] **Step 1: Write doc route**

```typescript
// src/app/api/doc/[uuid]/route.ts
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
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, no-store',
    },
  })
}
```

- [ ] **Step 2: Write download route**

```typescript
// src/app/api/download/[uuid]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getSignedPath, docExists, readMeta } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
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
  const buffer = fs.readFileSync(signedPath)
  const filename = `signed-${meta.originalName.replace(/\.[^.]+$/, '')}.pdf`
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    },
  })
}
```

- [ ] **Step 3: Manual test**

```bash
# Use uuid from Task 5 test
curl -o /tmp/out.pdf http://localhost:3000/api/doc/<uuid>
file /tmp/out.pdf
```

Expected: `PDF document`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/doc src/app/api/download
git commit -m "feat: GET /api/doc and /api/download stream PDF files"
```

---

## Task 7: POST /api/prepare/[uuid] and POST /api/sign/[uuid]

**Files:**
- Create: `src/app/api/prepare/[uuid]/route.ts`
- Create: `src/app/api/sign/[uuid]/route.ts`

- [ ] **Step 1: Write prepare route**

```typescript
// src/app/api/prepare/[uuid]/route.ts
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
```

- [ ] **Step 2: Write sign route**

```typescript
// src/app/api/sign/[uuid]/route.ts
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

  const formData = await req.formData()
  const sigFile = formData.get('signature')
  if (!sigFile || typeof sigFile === 'string') {
    return NextResponse.json({ error: 'No signature image provided' }, { status: 400 })
  }

  const sigBuffer = Buffer.from(await sigFile.arrayBuffer())
  const sigPath = path.join(getDocDir(uuid), 'signature.png')
  fs.writeFileSync(sigPath, sigBuffer)

  await embedSignature(getDocPath(uuid), sigPath, getSignedPath(uuid), meta.signatureZone)

  meta.signed = true
  writeMeta(uuid, meta)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Manual test prepare**

```bash
curl -X POST http://localhost:3000/api/prepare/<uuid> \
  -H "Content-Type: application/json" \
  -d '{"page":1,"x":100,"y":600,"width":200,"height":80}'
```

Expected: `{"ok":true}` and `meta.json` has `signatureZone` set

- [ ] **Step 4: Commit**

```bash
git add src/app/api/prepare src/app/api/sign
git commit -m "feat: POST /api/prepare saves zone, POST /api/sign embeds signature"
```

---

## Task 8: UploadZone Component and Upload Page

**Files:**
- Create: `src/components/UploadZone.tsx`
- Create: `src/app/page.tsx` (replace default)

- [ ] **Step 1: Write UploadZone component**

```tsx
// src/components/UploadZone.tsx
'use client'
import { useRef, useState, DragEvent, ChangeEvent } from 'react'

const ALLOWED = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
const MAX_MB = 20

interface Props {
  onUpload: (uuid: string) => void
}

export default function UploadZone({ onUpload }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED.includes(ext)) {
      setError(`Unsupported type. Allowed: ${ALLOWED.join(', ')}`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_MB}MB.`)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUpload(data.uuid)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#3b82f6' : '#6b7280'}`,
        borderRadius: 12,
        padding: 48,
        textAlign: 'center',
        cursor: loading ? 'wait' : 'pointer',
        background: dragging ? '#1e3a5f' : '#111',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <p style={{ fontSize: 18, color: '#e5e7eb', margin: 0 }}>
        {loading ? 'Uploading...' : '📄 Drop file here or click to browse'}
      </p>
      <p style={{ color: '#9ca3af', marginTop: 8, fontSize: 13 }}>
        PDF · DOC · DOCX · JPG · PNG — max {MAX_MB}MB
      </p>
      {error && <p style={{ color: '#ef4444', marginTop: 12 }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write upload page**

```tsx
// src/app/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'

export default function HomePage() {
  const router = useRouter()

  return (
    <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Document Signing
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: 32 }}>
        Upload a document to get a signing link for your manager.
      </p>
      <UploadZone onUpload={(uuid) => router.push(`/prepare/${uuid}`)} />
    </main>
  )
}
```

- [ ] **Step 3: Add global styles — replace src/app/globals.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #0a0a0a; color: #e5e7eb; font-family: system-ui, sans-serif; min-height: 100vh; }
a { color: #3b82f6; }
```

- [ ] **Step 4: Manual test in browser**

```bash
npm run dev
# Open http://localhost:3000
# Drop a PDF — should redirect to /prepare/<uuid>
```

Expected: Upload works, redirect to `/prepare/<uuid>` (will 404 for now — that's fine)

- [ ] **Step 5: Commit**

```bash
git add src/components/UploadZone.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: upload page with drag-and-drop zone"
```

---

## Task 9: PdfViewer and SignatureZoneDragger Components

**Files:**
- Create: `src/components/PdfViewer.tsx`
- Create: `src/components/SignatureZoneDragger.tsx`

- [ ] **Step 1: Configure next.config.ts for react-pdf worker**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
```

- [ ] **Step 2: Write PdfViewer component**

```tsx
// src/components/PdfViewer.tsx
'use client'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  url: string
  currentPage: number
  onPageCount?: (count: number) => void
  width?: number
  children?: React.ReactNode  // overlay (e.g. dragger)
}

export default function PdfViewer({ url, currentPage, onPageCount, width = 600, children }: Props) {
  const [pageCount, setPageCount] = useState(0)

  function onLoadSuccess({ numPages }: { numPages: number }) {
    setPageCount(numPages)
    onPageCount?.(numPages)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Document file={url} onLoadSuccess={onLoadSuccess}>
        <Page pageNumber={currentPage} width={width} />
      </Document>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Write SignatureZoneDragger component**

```tsx
// src/components/SignatureZoneDragger.tsx
'use client'
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
import { useRef } from 'react'

interface Position {
  x: number
  y: number
}

interface Props {
  position: Position
  width: number
  height: number
  onDrag: (pos: Position) => void
}

export default function SignatureZoneDragger({ position, width, height, onDrag }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null)

  function handleDrag(_e: DraggableEvent, data: DraggableData) {
    onDrag({ x: data.x, y: data.y })
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      position={position}
      onDrag={handleDrag}
    >
      <div
        ref={nodeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          border: '2px dashed #f59e0b',
          borderRadius: 4,
          background: 'rgba(245, 158, 11, 0.08)',
          cursor: 'move',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#f59e0b', fontSize: 13, pointerEvents: 'none' }}>
          ✍ Sign here
        </span>
      </div>
    </Draggable>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PdfViewer.tsx src/components/SignatureZoneDragger.tsx next.config.ts
git commit -m "feat: PdfViewer and SignatureZoneDragger components"
```

---

## Task 10: /prepare/[uuid] Page

**Files:**
- Create: `src/app/prepare/[uuid]/page.tsx`

- [ ] **Step 1: Write prepare page**

```tsx
// src/app/prepare/[uuid]/page.tsx
'use client'
import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import PdfViewer from '@/components/PdfViewer'
import SignatureZoneDragger from '@/components/SignatureZoneDragger'

const ZONE_W = 200
const ZONE_H = 80
const PDF_DISPLAY_WIDTH = 600

export default function PreparePage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [pdfHeight, setPdfHeight] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function onPageRendered() {
    const el = pdfContainerRef.current?.querySelector('canvas')
    if (el) setPdfHeight(el.offsetHeight)
  }

  async function handleConfirm() {
    if (!pdfHeight) return
    setLoading(true)
    setError(null)

    // Convert screen coords → PDF points
    // PDF page is typically 595pt wide (A4). Scale = 595 / PDF_DISPLAY_WIDTH
    const scaleFactor = 595 / PDF_DISPLAY_WIDTH
    const pdfX = Math.round(position.x * scaleFactor)
    // pdf-lib Y: origin bottom-left. pdfHeight in screen px, PDF pt height ≈ 842 (A4)
    const pdfPageHeightPt = Math.round(pdfHeight * scaleFactor)
    const pdfY = pdfPageHeightPt - Math.round((position.y + ZONE_H) * scaleFactor)

    try {
      const res = await fetch(`/api/prepare/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: currentPage,
          x: pdfX,
          y: pdfY,
          width: Math.round(ZONE_W * scaleFactor),
          height: Math.round(ZONE_H * scaleFactor),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save')
      }
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${baseUrl}/sign/${uuid}`)
  }

  if (done) {
    const link = `${baseUrl}/sign/${uuid}`
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Link Ready</h1>
        <p style={{ color: '#9ca3af', marginBottom: 24 }}>
          Send this link to your manager to sign:
        </p>
        <div style={{ background: '#111', borderRadius: 8, padding: 16, wordBreak: 'break-all', color: '#7ec8e3', fontSize: 14, marginBottom: 16 }}>
          {link}
        </div>
        <button
          onClick={copyLink}
          style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          📋 Copy Link
        </button>
        <p style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>Link expires in 7 days</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Place Signature Zone</h1>
      <p style={{ color: '#9ca3af', marginBottom: 16, fontSize: 14 }}>
        Drag the yellow box to where your manager should sign. Then click Confirm.
      </p>

      {pageCount > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {currentPage} / {pageCount}</span>
          <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            Next ›
          </button>
        </div>
      )}

      <div ref={pdfContainerRef} style={{ display: 'inline-block', position: 'relative', border: '1px solid #333', borderRadius: 4 }}>
        <PdfViewer
          url={`/api/doc/${uuid}`}
          currentPage={currentPage}
          onPageCount={setPageCount}
          width={PDF_DISPLAY_WIDTH}
        >
          <SignatureZoneDragger
            position={position}
            width={ZONE_W}
            height={ZONE_H}
            onDrag={setPosition}
          />
        </PdfViewer>
        {/* invisible element to capture rendered height */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} onLoad={onPageRendered} />
      </div>

      {error && <p style={{ color: '#ef4444', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          {loading ? 'Saving...' : 'Confirm & Get Link →'}
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Fix canvas height capture — update PdfViewer to call onRenderSuccess**

Update `src/components/PdfViewer.tsx` — add `onRenderSuccess` prop to `<Page>`:

```tsx
// Add to Props interface:
onRenderSuccess?: () => void

// Add to Page component:
<Page pageNumber={currentPage} width={width} onRenderSuccess={onRenderSuccess} />
```

Then in `PreparePage`, pass `onRenderSuccess={onPageRendered}` to `<PdfViewer>`.

- [ ] **Step 3: Manual test in browser**

```bash
# Upload a PDF at http://localhost:3000
# Should redirect to /prepare/<uuid>
# Drag yellow box, click Confirm → should show link
```

- [ ] **Step 4: Commit**

```bash
git add src/app/prepare src/components/PdfViewer.tsx
git commit -m "feat: prepare page — drag signature zone and get shareable link"
```

---

## Task 11: SignaturePad Component and /sign/[uuid] Page

**Files:**
- Create: `src/components/SignaturePad.tsx`
- Create: `src/app/sign/[uuid]/page.tsx`

- [ ] **Step 1: Write SignaturePad component**

```tsx
// src/components/SignaturePad.tsx
'use client'
import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
  onExport: (dataUrl: string) => void
}

export default function SignaturePad({ onExport }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null)

  function clear() {
    canvasRef.current?.clear()
  }

  function save() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return
    const dataUrl = canvasRef.current.getTrimmedCanvas().toDataURL('image/png')
    onExport(dataUrl)
  }

  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Draw your signature:</p>
      <div style={{ border: '1px solid #444', borderRadius: 8, background: '#0d0d0d', display: 'inline-block' }}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#ffffff"
          canvasProps={{ width: 400, height: 120, style: { borderRadius: 8 } }}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <button
          onClick={clear}
          style={{ padding: '8px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Clear
        </button>
        <button
          onClick={save}
          style={{ padding: '8px 28px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          ✅ Sign & Save
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write sign page**

```tsx
// src/app/sign/[uuid]/page.tsx
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import PdfViewer from '@/components/PdfViewer'
import SignaturePad from '@/components/SignaturePad'

export default function SignPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)

  async function handleSign(dataUrl: string) {
    setLoading(true)
    setError(null)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const form = new FormData()
      form.append('signature', blob, 'signature.png')
      const res = await fetch(`/api/sign/${uuid}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signing failed')
      setSigned(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signing failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {signed ? '✅ Document Signed' : 'Sign Document'}
      </h1>

      {pageCount > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {currentPage} / {pageCount}</span>
          <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            Next ›
          </button>
        </div>
      )}

      <div style={{ border: '1px solid #333', borderRadius: 4, display: 'inline-block', marginBottom: 24 }}>
        <PdfViewer
          url={signed ? `/api/download/${uuid}?preview=1` : `/api/doc/${uuid}`}
          currentPage={currentPage}
          onPageCount={setPageCount}
          width={600}
        />
      </div>

      {signed ? (
        <div>
          <a
            href={`/api/download/${uuid}`}
            download
            style={{ display: 'inline-block', padding: '12px 32px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 15 }}
          >
            ⬇ Download Signed PDF
          </a>
        </div>
      ) : (
        <div>
          {loading && <p style={{ color: '#9ca3af' }}>Saving signature...</p>}
          {!loading && <SignaturePad onExport={handleSign} />}
          {error && <p style={{ color: '#ef4444', marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Update download route to support preview mode**

In `src/app/api/download/[uuid]/route.ts`, change the response header check for `?preview=1` to serve inline instead of attachment:

```typescript
// After building the buffer, before returning:
const preview = req.nextUrl.searchParams.get('preview')
const disposition = preview ? 'inline' : `attachment; filename="${filename}"`
// Use disposition in Content-Disposition header
```

- [ ] **Step 4: Manual test full flow**

```bash
# 1. Upload a PDF at http://localhost:3000
# 2. Place signature zone, click Confirm → copy link
# 3. Open link in new tab (or same browser)
# 4. Draw signature, click Sign & Save
# 5. PDF viewer refreshes showing signed doc
# 6. Click Download Signed PDF
```

Expected: Downloaded PDF has drawn signature at the zone position

- [ ] **Step 5: Commit**

```bash
git add src/components/SignaturePad.tsx src/app/sign src/app/api/download
git commit -m "feat: sign page with signature pad and signed PDF download"
```

---

## Task 12: 404 Page and Already-Signed State

**Files:**
- Create: `src/app/not-found.tsx`
- Modify: `src/app/sign/[uuid]/page.tsx`

- [ ] **Step 1: Write 404 page**

```tsx
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#374151' }}>404</h1>
      <p style={{ fontSize: 18, color: '#9ca3af', marginTop: 12 }}>
        Link expired or invalid.
      </p>
      <p style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
        Documents are deleted after 7 days.
      </p>
      <a href="/" style={{ display: 'inline-block', marginTop: 24, color: '#3b82f6' }}>
        ← Upload a new document
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Add already-signed detection to sign page**

Add to `SignPage` component, before the main return — fetch meta on mount to check if already signed:

```tsx
// Add these imports at top:
import { useEffect } from 'react'

// Add inside SignPage component, after state declarations:
useEffect(() => {
  fetch(`/api/doc/${uuid}`, { method: 'HEAD' })
    .then(res => {
      if (res.status === 404) window.location.href = '/404'
    })
  // Check if already signed by trying download
  fetch(`/api/download/${uuid}`)
    .then(res => { if (res.ok) setSigned(true) })
}, [uuid])
```

- [ ] **Step 3: Commit**

```bash
git add src/app/not-found.tsx src/app/sign
git commit -m "feat: 404 page and already-signed auto-detection on sign page"
```

---

## Task 13: Cleanup Cron Job

**Files:**
- Create: `src/lib/cleanup.ts`
- Create: `src/lib/cleanup.test.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/cleanup.test.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { cleanupExpired } from '@/lib/cleanup'
import type { Meta } from '@/lib/types'

let tmpDir: string
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'))
  process.env.UPLOAD_DIR = tmpDir
})
afterEach(() => fs.rmSync(tmpDir, { recursive: true }))

function makeDoc(uuid: string, daysOld: number) {
  const dir = path.join(tmpDir, uuid)
  fs.mkdirSync(dir)
  const meta: Meta = {
    createdAt: new Date(Date.now() - daysOld * 86400000).toISOString(),
    expiresAt: new Date(Date.now() - (daysOld - 7) * 86400000).toISOString(),
    originalName: 'file.pdf',
    signed: false,
    signatureZone: null,
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta))
}

test('cleanupExpired deletes folders past expiresAt', () => {
  makeDoc('old-doc', 8)  // 8 days old → expired
  makeDoc('new-doc', 3)  // 3 days old → keep
  cleanupExpired()
  expect(fs.existsSync(path.join(tmpDir, 'old-doc'))).toBe(false)
  expect(fs.existsSync(path.join(tmpDir, 'new-doc'))).toBe(true)
})

test('cleanupExpired skips folders without meta.json', () => {
  const dir = path.join(tmpDir, 'no-meta')
  fs.mkdirSync(dir)
  expect(() => cleanupExpired()).not.toThrow()
  expect(fs.existsSync(dir)).toBe(true)
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npm test -- cleanup.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/cleanup'`

- [ ] **Step 3: Write cleanup.ts**

```typescript
// src/lib/cleanup.ts
import fs from 'fs'
import path from 'path'
import cron from 'node-cron'

export function cleanupExpired(): void {
  const uploadDir = process.env.UPLOAD_DIR
  if (!uploadDir || !fs.existsSync(uploadDir)) return

  const now = Date.now()
  const entries = fs.readdirSync(uploadDir)

  for (const entry of entries) {
    const dirPath = path.join(uploadDir, entry)
    const metaPath = path.join(dirPath, 'meta.json')

    if (!fs.existsSync(metaPath)) continue

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      if (new Date(meta.expiresAt).getTime() < now) {
        fs.rmSync(dirPath, { recursive: true })
      }
    } catch {
      // malformed meta — skip
    }
  }
}

export function startCleanupCron(): void {
  // Run daily at 02:00
  cron.schedule('0 2 * * *', cleanupExpired)
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- cleanup.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Register cron in layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

// Start cleanup cron once on server startup
if (typeof window === 'undefined') {
  import('@/lib/cleanup').then(({ startCleanupCron }) => startCleanupCron())
}

export const metadata: Metadata = {
  title: 'Document Signing',
  description: 'Upload, sign, and download documents',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/cleanup.ts src/lib/cleanup.test.ts src/app/layout.tsx
git commit -m "feat: daily cleanup cron deletes expired document folders"
```

---

## Task 14: Deployment

**Files:**
- Create: `ecosystem.config.js` (PM2 config)

- [ ] **Step 1: Build for production**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Create PM2 config**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'documents-system',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
}
```

- [ ] **Step 3: On DigitalOcean Droplet — install dependencies**

```bash
# Run on Droplet as root or sudo user
apt update && apt install -y libreoffice nodejs npm
npm install -g pm2
```

- [ ] **Step 4: On Droplet — set up app**

```bash
mkdir -p /var/www/documents-system/uploads
chown -R $USER:$USER /var/www/documents-system
# Clone or rsync project to /var/www/documents-system
cd /var/www/documents-system
npm install
cp .env.example .env.local
# Edit .env.local: set UPLOAD_DIR, BASE_URL
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow printed command to auto-start on reboot
```

- [ ] **Step 5: Verify LibreOffice conversion works**

```bash
# On Droplet:
libreoffice --headless --convert-to pdf /tmp/test.docx --outdir /tmp
# Should produce /tmp/test.pdf
```

- [ ] **Step 6: Final end-to-end test on production URL**

```
1. Open https://yourdomain.com
2. Upload a DOCX file
3. Place signature zone → copy link
4. Open link → draw signature → sign
5. Download → verify PDF has signature at correct position
```

- [ ] **Step 7: Commit**

```bash
git add ecosystem.config.js
git commit -m "chore: add PM2 config for production deployment"
```

---

## Self-Review Checklist

| Spec Requirement | Covered In |
|---|---|
| Upload PDF/DOCX/DOC/JPG/PNG | Task 5, Task 3 |
| Convert to normalized PDF | Task 3, Task 5 |
| UUID-based shareable link | Task 5, Task 10 |
| Drag signature zone on PDF | Task 9, Task 10 |
| Coordinate conversion px→PDF points | Task 10 |
| Manager views PDF + draws signature | Task 11 |
| Embed signature at saved coordinates | Task 4, Task 7 |
| Both parties can download | Task 6, Task 11 |
| meta.json starts with null signatureZone | Task 2 |
| Files expire after 7 days | Task 2, Task 13 |
| Cleanup cron at 02:00 | Task 13 |
| 404 for missing/expired UUID | Task 12 |
| File too large → 413 | Task 5 |
| Already signed → download only | Task 12 |
| Upload fails → cleanup partial folder | Task 5 |
| No login required | (no auth anywhere — by design) |
| DigitalOcean Droplet deploy | Task 14 |
