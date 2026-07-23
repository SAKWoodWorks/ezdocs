'use client'
import { useState, useEffect } from 'react'

interface Stamp {
  id: string
  url: string
}

export default function StampsPage() {
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/stamps')
    if (res.ok) setStamps(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('stamp', file)
      const res = await fetch('/api/stamps', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/stamps/${id}`, { method: 'DELETE' })
    setStamps(s => s.filter(x => x.id !== id))
  }

  return (
    <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Stamp Library</h1>
        <label style={{
          padding: '8px 20px', background: '#3b82f6', color: '#fff',
          borderRadius: 8, cursor: uploading ? 'default' : 'pointer', fontSize: 14,
        }}>
          {uploading ? 'Uploading…' : '+ Upload Stamp'}
          <input type="file" accept="image/png,image/jpeg" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      {error && <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>}

      {stamps.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No stamps yet. Upload a PNG or JPG of your company stamp.</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {stamps.map(s => (
            <div key={s.id} style={{
              width: 120, height: 120, background: '#fff', border: '1px solid #374151',
              borderRadius: 8, position: 'relative', display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              <img src={s.url} alt="stamp" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              <button
                onClick={() => handleDelete(s.id)}
                style={{
                  position: 'absolute', top: 4, right: 4, background: '#ef4444',
                  color: '#fff', border: 'none', borderRadius: '50%',
                  width: 22, height: 22, fontSize: 13, cursor: 'pointer',
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
