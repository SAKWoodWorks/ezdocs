'use client'
import { QRCodeSVG } from 'qrcode.react'

export default function QRCode({ url }: { url: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
        Scan to sign on mobile
      </p>
      <QRCodeSVG value={url} size={180} bgColor="#ffffff" fgColor="#111827" />
    </div>
  )
}
