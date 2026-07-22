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
