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
