import fs from 'fs'
import path from 'path'
import type { Meta } from '@/lib/types'

function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR
  if (!dir) throw new Error('UPLOAD_DIR env var not set')
  return dir
}

export function getDocDir(uuid: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new Error('Invalid UUID')
  }
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

export async function readMeta(uuid: string): Promise<Meta> {
  try {
    const raw = await fs.promises.readFile(getMetaPath(uuid), 'utf-8')
    return JSON.parse(raw) as Meta
  } catch (err) {
    throw new Error(`Failed to read meta for ${uuid}: ${(err as Error).message}`)
  }
}

export async function writeMeta(uuid: string, meta: Meta): Promise<void> {
  await fs.promises.writeFile(getMetaPath(uuid), JSON.stringify(meta, null, 2), 'utf-8')
}

export async function createMeta(uuid: string, originalName: string): Promise<void> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  await writeMeta(uuid, {
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    originalName,
    signed: false,
    signatureZone: null,
  })
}

export async function docExists(uuid: string): Promise<boolean> {
  try {
    await fs.promises.access(getDocDir(uuid))
    return true
  } catch {
    return false
  }
}
