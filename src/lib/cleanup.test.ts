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
