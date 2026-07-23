'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), { ssr: false })
const QRCode = dynamic(() => import('@/components/QRCode'), { ssr: false })
import SignaturePad from '@/components/SignaturePad'

export default function SignPage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [pageUrl, setPageUrl] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setPageUrl(window.location.href)
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    fetch(`/api/doc/${uuid}`, { method: 'HEAD' })
      .then(res => { if (res.status === 404) window.location.href = '/not-found' })
    fetch(`/api/status/${uuid}`)
      .then(res => res.json())
      .then(data => { if (data.signed) setSigned(true) })
  }, [uuid])

  useEffect(() => {
    if (signed) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(() => {
      fetch(`/api/status/${uuid}`)
        .then(res => res.json())
        .then(data => { if (data.signed) setSigned(true) })
        .catch(() => {})
    }, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [uuid, signed])

  async function handleSign(dataUrl: string) {
    setLoading(true)
    setError(null)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const form = new FormData()
      form.append('signature', blob, 'signature.png')
      const res = await fetch(`/api/sign/${uuid}`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signing failed')
      setSigned(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Signing failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {signed ? '✅ Document Signed' : 'Sign Document'}
      </h1>

      {pageCount > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {currentPage} / {pageCount}</span>
          <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
            style={{ padding: '4px 12px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 6, cursor: 'pointer' }}>
            Next ›
          </button>
        </div>
      )}

      <div style={{ border: '1px solid #333', borderRadius: 4, display: 'inline-block', marginBottom: 24 }}>
        <PdfViewer
          url={signed ? `/api/download/${uuid}?preview=1` : `/api/doc/${uuid}`}
          currentPage={currentPage}
          onPageCount={setPageCount}
          width={600}
        />
      </div>

      {signed ? (
        <div>
          <a
            href={`/api/download/${uuid}`}
            download
            style={{ display: 'inline-block', padding: '12px 32px', background: '#3b82f6', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 15 }}
          >
            ⬇ Download Signed PDF
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            {loading && <p style={{ color: '#9ca3af' }}>Saving signature...</p>}
            {!loading && <SignaturePad onExport={handleSign} />}
            {error && <p style={{ color: '#ef4444', marginTop: 8 }}>{error}</p>}
          </div>
          {!isMobile && pageUrl && (
            <QRCode url={pageUrl} />
          )}
        </div>
      )}
    </main>
  )
}
