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
