import fs from 'fs'
import path from 'path'
import os from 'os'
import { getDocDir, getDocPath, getSignedPath, getMetaPath, readMeta, writeMeta, createMeta, docExists } from '@/lib/storage'
import type { Meta } from '@/lib/types'

// Valid v4 UUIDs for testing
const VALID_UUID = '550e8400-e29b-4d4f-a716-446655440000'
const VALID_UUID_2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const VALID_UUID_3 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const VALID_UUID_4 = '6ba7b811-9dad-41d1-80b4-00c04fd430c8'
const VALID_UUID_5 = '6ba7b812-9dad-41d1-80b4-00c04fd430c8'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsign-'))
  process.env.UPLOAD_DIR = tmpDir
})

afterEach(() => fs.rmSync(tmpDir, { recursive: true }))

test('getDocDir returns path inside UPLOAD_DIR', () => {
  expect(getDocDir(VALID_UUID)).toBe(path.join(tmpDir, VALID_UUID))
})

test('getDocDir throws on invalid UUID', () => {
  expect(() => getDocDir('abc123')).toThrow('Invalid UUID')
  expect(() => getDocDir('../etc/passwd')).toThrow('Invalid UUID')
})

test('getDocPath returns document.pdf path', () => {
  expect(getDocPath(VALID_UUID)).toBe(path.join(tmpDir, VALID_UUID, 'document.pdf'))
})

test('getMetaPath returns meta.json path', () => {
  expect(getMetaPath(VALID_UUID)).toBe(path.join(tmpDir, VALID_UUID, 'meta.json'))
})

test('writeMeta and readMeta round-trip', async () => {
  const uuid = VALID_UUID_2
  fs.mkdirSync(path.join(tmpDir, uuid))
  const meta: Meta = {
    createdAt: '2026-07-22T00:00:00Z',
    expiresAt: '2026-07-29T00:00:00Z',
    originalName: 'file.pdf',
    signed: false,
    signatureZones: [],
  }
  await writeMeta(uuid, meta)
  expect(await readMeta(uuid)).toEqual(meta)
})

test('createMeta writes initial meta with empty signatureZones', async () => {
  const uuid = VALID_UUID_3
  fs.mkdirSync(path.join(tmpDir, uuid))
  await createMeta(uuid, 'contract.pdf')
  const meta = await readMeta(uuid)
  expect(meta.signed).toBe(false)
  expect(meta.signatureZones).toEqual([])
  expect(meta.originalName).toBe('contract.pdf')
})

test('getSignedPath returns signed.pdf path', () => {
  expect(getSignedPath(VALID_UUID)).toBe(path.join(tmpDir, VALID_UUID, 'signed.pdf'))
})

test('docExists returns true when dir exists', async () => {
  const uuid = VALID_UUID_4
  fs.mkdirSync(path.join(tmpDir, uuid))
  expect(await docExists(uuid)).toBe(true)
})

test('docExists returns false when dir missing', async () => {
  expect(await docExists(VALID_UUID_5)).toBe(false)
})
