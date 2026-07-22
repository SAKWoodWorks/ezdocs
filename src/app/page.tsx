'use client'
import { useRouter } from 'next/navigation'
import UploadZone from '@/components/UploadZone'

export default function HomePage() {
  const router = useRouter()

  return (
    <main style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Document Signing
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: 32 }}>
        Upload a document to get a signing link for your manager.
      </p>
      <UploadZone onUpload={(uuid) => router.push(`/prepare/${uuid}`)} />
    </main>
  )
}
