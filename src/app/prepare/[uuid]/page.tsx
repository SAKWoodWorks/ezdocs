'use client'
import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import PdfViewer from '@/components/PdfViewer'
import SignatureZoneDragger from '@/components/SignatureZoneDragger'

const ZONE_W = 200
const ZONE_H = 80
const PDF_DISPLAY_WIDTH = 600

export default function PreparePage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [pdfHeight, setPdfHeight] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function onPageRendered() {
    const el = pdfContainerRef.current?.querySelector('canvas')
    if (el) setPdfHeight(el.offsetHeight)
  }

  async function handleConfirm() {
    if (!pdfHeight) return
    setLoading(true)
    setError(null)

    // Convert screen coords → PDF points
    // PDF page is typically 595pt wide (A4). Scale = 595 / PDF_DISPLAY_WIDTH
    const scaleFactor = 595 / PDF_DISPLAY_WIDTH
    const pdfX = Math.round(position.x * scaleFactor)
    // pdf-lib Y: origin bottom-left. pdfHeight in screen px, PDF pt height ≈ 842 (A4)
    const pdfPageHeightPt = Math.round(pdfHeight * scaleFactor)
    const pdfY = pdfPageHeightPt - Math.round((position.y + ZONE_H) * scaleFactor)

    try {
      const res = await fetch(`/api/prepare/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: currentPage,
          x: pdfX,
          y: pdfY,
          width: Math.round(ZONE_W * scaleFactor),
          height: Math.round(ZONE_H * scaleFactor),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to save')
      }
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${baseUrl}/sign/${uuid}`)
  }

  if (done) {
    const link = `${baseUrl}/sign/${uuid}`
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Link Ready</h1>
        <p style={{ color: '#9ca3af', marginBottom: 24 }}>
          Send this link to your manager to sign:
        </p>
        <div style={{ background: '#111', borderRadius: 8, padding: 16, wordBreak: 'break-all', color: '#7ec8e3', fontSize: 14, marginBottom: 16 }}>
          {link}
        </div>
        <button
          onClick={copyLink}
          style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          Copy Link
        </button>
        <p style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>Link expires in 7 days</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Place Signature Zone</h1>
      <p style={{ color: '#9ca3af', marginBottom: 16, fontSize: 14 }}>
        Drag the yellow box to where your manager should sign. Then click Confirm.
      </p>

      {pageCount > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            Prev
          </button>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {currentPage} / {pageCount}</span>
          <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            Next
          </button>
        </div>
      )}

      <div ref={pdfContainerRef} style={{ display: 'inline-block', position: 'relative', border: '1px solid #333', borderRadius: 4 }}>
        <PdfViewer
          url={`/api/doc/${uuid}`}
          currentPage={currentPage}
          onPageCount={setPageCount}
          onRenderSuccess={onPageRendered}
          width={PDF_DISPLAY_WIDTH}
        >
          <SignatureZoneDragger
            position={position}
            width={ZONE_W}
            height={ZONE_H}
            onDrag={setPosition}
          />
        </PdfViewer>
      </div>

      {error && <p style={{ color: '#ef4444', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          {loading ? 'Saving...' : 'Confirm & Get Link'}
        </button>
      </div>
    </main>
  )
}
