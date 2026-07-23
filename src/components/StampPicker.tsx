'use client'

interface Stamp {
  id: string
  url: string
}

interface Props {
  stamps: Stamp[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onUpload: (file: File) => void
  uploading: boolean
}

export default function StampPicker({ stamps, selectedId, onSelect, onDelete, onUpload, uploading }: Props) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: '#d1d5db', fontWeight: 600 }}>Company Stamp</span>
        <label style={{
          padding: '4px 14px', background: '#374151', color: '#fff',
          border: '1px solid #4b5563', borderRadius: 6, cursor: uploading ? 'default' : 'pointer', fontSize: 13,
        }}>
          {uploading ? 'Uploading…' : '+ Upload Stamp'}
          <input type="file" accept="image/png,image/jpeg" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
        </label>
        <a href="/stamps" target="_blank" style={{ fontSize: 12, color: '#6b7280' }}>Manage library →</a>
      </div>

      {stamps.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>No stamps yet. Upload one above to place it on the document.</p>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Click to select which stamp to place (blue border = active):</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {stamps.map(s => (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                style={{
                  width: 80, height: 80, border: selectedId === s.id ? '2px solid #3b82f6' : '2px solid #374151',
                  borderRadius: 6, background: '#fff', cursor: 'pointer', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  boxShadow: selectedId === s.id ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none',
                }}
              >
                <img src={s.url} alt="stamp" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                <button
                  onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                  style={{
                    position: 'absolute', top: 2, right: 2, background: '#ef4444', color: '#fff',
                    border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11,
                    cursor: 'pointer', lineHeight: '18px', padding: 0,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
