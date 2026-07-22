'use client'
import { useRef, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
  onExport: (dataUrl: string) => void
}

export default function SignaturePad({ onExport }: Props) {
  const canvasRef = useRef<SignatureCanvas>(null)

  useEffect(() => {
    const sc = canvasRef.current
    if (!sc) return
    const canvas = sc.getCanvas()
    const dpr = window.devicePixelRatio || 1
    if (dpr <= 1) return
    const displayW = 400
    const displayH = 120
    // Set internal pixel density, then lock CSS size so canvas doesn't expand
    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    canvas.style.width = displayW + 'px'
    canvas.style.height = displayH + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    sc.clear()
  }, [])

  function clear() {
    canvasRef.current?.clear()
  }

  function save() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return
    const trimmed = canvasRef.current.getTrimmedCanvas()
    // Composite onto white background so the PNG is never transparent-on-white (invisible in PDF)
    const canvas = document.createElement('canvas')
    canvas.width = trimmed.width
    canvas.height = trimmed.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(trimmed, 0, 0)
    onExport(canvas.toDataURL('image/png'))
  }

  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Draw your signature:</p>
      <div style={{ border: '1px solid #aaa', borderRadius: 8, background: '#ffffff', display: 'inline-block', colorScheme: 'light' }}>
        <SignatureCanvas
          ref={canvasRef}
          penColor="#1a1a2e"
          minWidth={1}
          maxWidth={2.5}
          velocityFilterWeight={0.7}
          canvasProps={{ width: 400, height: 120, style: { borderRadius: 8, background: '#ffffff', colorScheme: 'light' } }}
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
