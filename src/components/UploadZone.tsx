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
