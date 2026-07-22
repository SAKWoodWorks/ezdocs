'use client'
import { useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
  onExport: (dataUrl: string) => void
}

export default function SignaturePad({ onExport }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null)

  function clear() {
    canvasRef.current?.clear()
  }

  function save() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return
    const dataUrl = canvasRef.current.getTrimmedCanvas().toDataURL('image/png')
    onExport(dataUrl)
  }

  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Draw your signature:</p>
      <div style={{ border: '1px solid #444', borderRadius: 8, background: '#0d0d0d', display: 'inline-block' }}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#ffffff"
          canvasProps={{ width: 400, height: 120, style: { borderRadius: 8 } }}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <button
          onClick={clear}
          style={{ padding: '8px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Clear
        </button>
        <button
          onClick={save}
          style={{ padding: '8px 28px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          ✅ Sign & Save
        </button>
      </div>
    </div>
  )
}
