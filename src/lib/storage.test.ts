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
