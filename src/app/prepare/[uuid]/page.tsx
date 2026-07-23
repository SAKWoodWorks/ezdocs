'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import SignatureZoneDragger from '@/components/SignatureZoneDragger'
import StampZoneDragger from '@/components/StampZoneDragger'
import StampPicker from '@/components/StampPicker'
import type { SignatureZone, StampZone } from '@/lib/types'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })
const QRCode = dynamic(() => import('@/components/QRCode'), { ssr: false })

const ZONE_W = 200
const ZONE_H = 80
const STAMP_W = 120
const STAMP_H = 120
const PDF_DISPLAY_WIDTH = 600
const DEFAULT_SIG_POS = { x: 50, y: 50 }
const DEFAULT_STAMP_POS = { x: 380, y: 50 }

interface Stamp {
  id: string
  url: string
}

export default function PreparePage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagePositions, setPagePositions] = useState<Record<number, { x: number; y: number } | null>>({})
  const [position, setPosition] = useState(DEFAULT_SIG_POS)
  const [included, setIncluded] = useState(true)
  const [pdfHeight, setPdfHeight] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Stamp state
  const [stamps, setStamps] = useState<Stamp[]>([])
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null)
  const [stampUploading, setStampUploading] = useState(false)
  const [stampPagePositions, setStampPagePositions] = useState<Record<number, { x: number; y: number } | null>>({})
  const [stampPosition, setStampPosition] = useState(DEFAULT_STAMP_POS)
  const [stampIncluded, setStampIncluded] = useState(true)

  useEffect(() => {
    fetch('/api/stamps')
      .then(r => r.json())
      .then((data: Stamp[]) => {
        setStamps(data)
        if (data.length > 0) setSelectedStampId(data[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!done || signed) return
    pollRef.current = setInterval(() => {
      fetch(`/api/status/${uuid}`)
        .then(res => res.json())
        .then(data => { if (data.signed) setSigned(true) })
        .catch(() => {})
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [done, signed, uuid])

  function onPageRendered() {
    const el = pdfContainerRef.current?.querySelector('canvas')
    if (el) setPdfHeight(el.offsetHeight)
  }

  function goToPage(newPage: number) {
    const savedPos = included ? position : null
    const updatedPositions = { ...pagePositions, [currentPage]: savedPos }
    setPagePositions(updatedPositions)

    const savedStampPos = stampIncluded ? stampPosition : null
    const updatedStampPositions = { ...stampPagePositions, [currentPage]: savedStampPos }
    setStampPagePositions(updatedStampPositions)

    const existing = updatedPositions[newPage]
    if (existing === undefined) {
      setPosition(DEFAULT_SIG_POS)
      setIncluded(true)
    } else if (existing === null) {
      setPosition(DEFAULT_SIG_POS)
      setIncluded(false)
    } else {
      setPosition(existing)
      setIncluded(true)
    }

    const existingStamp = updatedStampPositions[newPage]
    if (existingStamp === undefined) {
      setStampPosition(DEFAULT_STAMP_POS)
      setStampIncluded(true)
    } else if (existingStamp === null) {
      setStampPosition(DEFAULT_STAMP_POS)
      setStampIncluded(false)
    } else {
      setStampPosition(existingStamp)
      setStampIncluded(true)
    }

    setCurrentPage(newPage)
  }

  async function handleStampUpload(file: File) {
    setStampUploading(true)
    try {
      const form = new FormData()
      form.append('stamp', file)
      const res = await fetch('/api/stamps', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      const newStamp: Stamp = { id: data.id, url: data.url }
      setStamps(s => [...s, newStamp])
      setSelectedStampId(data.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Stamp upload failed')
    } finally {
      setStampUploading(false)
    }
  }

  async function handleStampDelete(id: string) {
    await fetch(`/api/stamps/${id}`, { method: 'DELETE' })
    setStamps(s => s.filter(x => x.id !== id))
    if (selectedStampId === id) setSelectedStampId(null)
  }

  async function handleConfirm() {
    if (!pdfHeight) return
    const finalPositions = { ...pagePositions, [currentPage]: included ? position : null }
    const finalStampPositions = { ...stampPagePositions, [currentPage]: stampIncluded ? stampPosition : null }

    const scaleFactor = 595 / PDF_DISPLAY_WIDTH
    const zones: SignatureZone[] = []
    for (let p = 1; p <= pageCount; p++) {
      const pos = finalPositions[p]
      if (pos === undefined) {
        zones.push({
          page: p,
          x: Math.round(DEFAULT_SIG_POS.x * scaleFactor),
          y: Math.round(DEFAULT_SIG_POS.y * scaleFactor),
          width: Math.round(ZONE_W * scaleFactor),
          height: Math.round(ZONE_H * scaleFactor),
        })
      } else if (pos !== null) {
        zones.push({
          page: p,
          x: Math.round(pos.x * scaleFactor),
          y: Math.round(pos.y * scaleFactor),
          width: Math.round(ZONE_W * scaleFactor),
          height: Math.round(ZONE_H * scaleFactor),
        })
      }
    }

    if (zones.length === 0) {
      setError('Select at least one page to sign')
      return
    }

    const stampZones: StampZone[] = []
    if (selectedStampId) {
      for (let p = 1; p <= pageCount; p++) {
        const pos = finalStampPositions[p]
        if (pos === undefined) {
          stampZones.push({
            page: p,
            stampId: selectedStampId,
            x: Math.round(DEFAULT_STAMP_POS.x * scaleFactor),
            y: Math.round(DEFAULT_STAMP_POS.y * scaleFactor),
            width: Math.round(STAMP_W * scaleFactor),
            height: Math.round(STAMP_H * scaleFactor),
          })
        } else if (pos !== null) {
          stampZones.push({
            page: p,
            stampId: selectedStampId,
            x: Math.round(pos.x * scaleFactor),
            y: Math.round(pos.y * scaleFactor),
            width: Math.round(STAMP_W * scaleFactor),
            height: Math.round(STAMP_H * scaleFactor),
          })
        }
      }
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/prepare/${uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, stampZones }),
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

  const signedCount = (() => {
    let count = 0
    for (let p = 1; p <= pageCount; p++) {
      const pos = pagePositions[p]
      if (pos === undefined || pos !== null) count++
    }
    const savedCurrent = pagePositions[currentPage]
    if (savedCurrent === undefined) {
      if (!included) count--
    } else if (savedCurrent === null && included) {
      count++
    } else if (savedCurrent !== null && !included) {
      count--
    }
    return Math.max(0, count)
  })()

  const selectedStamp = stamps.find(s => s.id === selectedStampId) ?? null

  if (done) {
    const link = `${baseUrl}/sign/${uuid}`
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {signed ? '✅ Document Signed' : 'Link Ready'}
        </h1>

        {signed ? (
          <div>
            <p style={{ color: '#9ca3af', marginBottom: 24 }}>Signature received. Download your signed PDF:</p>
            <a
              href={`/api/download/${uuid}`}
              download
              style={{ display: 'inline-block', padding: '12px 32px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 15 }}
            >
              ⬇ Download Signed PDF
            </a>
          </div>
        ) : (
          <div>
            <p style={{ color: '#9ca3af', marginBottom: 16 }}>Send this link to the signer:</p>
            <div style={{ background: '#111', borderRadius: 8, padding: 16, wordBreak: 'break-all', color: '#7ec8e3', fontSize: 14, marginBottom: 16 }}>
              {link}
            </div>
            <button
              onClick={copyLink}
              style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, marginBottom: 24 }}
            >
              Copy Link
            </button>
            <div style={{ marginTop: 8 }}>
              <QRCode url={link} />
            </div>
            <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
              Waiting for signature… this page updates automatically. Link expires in 7 days.
            </p>
          </div>
        )}
      </main>
    )
  }

  return (
    <main style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Place Signature Zones</h1>
      <p style={{ color: '#9ca3af', marginBottom: 16, fontSize: 14 }}>
        Navigate each page, drag the yellow box to where your manager should sign, then click Confirm.
      </p>

      <StampPicker
        stamps={stamps}
        selectedId={selectedStampId}
        onSelect={setSelectedStampId}
        onDelete={handleStampDelete}
        onUpload={handleStampUpload}
        uploading={stampUploading}
      />

      {/* Page navigation */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => goToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}
        >
          ‹ Prev
        </button>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {currentPage} / {pageCount}</span>
        <button
          onClick={() => goToPage(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage === pageCount}
          style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}
        >
          Next ›
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#d1d5db', marginLeft: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={included} onChange={e => setIncluded(e.target.checked)} />
          Sign this page
        </label>

        {selectedStampId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#93c5fd', cursor: 'pointer' }}>
            <input type="checkbox" checked={stampIncluded} onChange={e => setStampIncluded(e.target.checked)} />
            Stamp this page
          </label>
        )}
      </div>

      {/* Page indicator dots */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: pageCount }, (_, i) => {
            const p = i + 1
            const pos = p === currentPage
              ? (included ? position : null)
              : pagePositions[p]
            const isSigned = pos === undefined || pos !== null
            return (
              <button
                key={p}
                onClick={() => goToPage(p)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: p === currentPage ? '#3b82f6' : isSigned ? '#10b981' : '#374151',
                  color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11,
                }}
              >
                {p}
              </button>
            )
          })}
          <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            {signedCount} of {pageCount} pages will be signed
          </span>
        </div>
      )}

      {/* PDF + draggable zones */}
      <div ref={pdfContainerRef} style={{ display: 'inline-block', position: 'relative', border: '1px solid #333', borderRadius: 4, opacity: included ? 1 : 0.5 }}>
        <PdfViewer
          url={`/api/doc/${uuid}`}
          currentPage={currentPage}
          onPageCount={setPageCount}
          onRenderSuccess={onPageRendered}
          width={PDF_DISPLAY_WIDTH}
        >
          {included && (
            <SignatureZoneDragger
              position={position}
              width={ZONE_W}
              height={ZONE_H}
              onDrag={setPosition}
            />
          )}
          {selectedStamp && stampIncluded && (
            <StampZoneDragger
              position={stampPosition}
              width={STAMP_W}
              height={STAMP_H}
              imageUrl={selectedStamp.url}
              onDrag={setStampPosition}
            />
          )}
        </PdfViewer>
      </div>

      {!included && (
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>This page will be skipped.</p>
      )}

      {error && <p style={{ color: '#ef4444', marginTop: 12 }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ padding: '12px 32px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
        >
          {loading ? 'Saving...' : `Confirm & Get Link (${signedCount} page${signedCount !== 1 ? 's' : ''})`}
        </button>
      </div>
    </main>
  )
}
