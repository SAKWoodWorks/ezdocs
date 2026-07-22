import fs from 'fs'
import path from 'path'
import os from 'os'
import { PDFDocument } from 'pdf-lib'
import { embedSignature } from '@/lib/embed-signature'
import type { SignatureZone } from '@/lib/types'

let tmpDir: string
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'embed-'))
})
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true })
})

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
  await sharp({
    create: {
      width: 200,
      height: 80,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toFile(p)
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
