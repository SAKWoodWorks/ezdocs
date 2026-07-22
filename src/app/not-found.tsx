export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#374151' }}>404</h1>
      <p style={{ fontSize: 18, color: '#9ca3af', marginTop: 12 }}>
        Link expired or invalid.
      </p>
      <p style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
        Documents are deleted after 7 days.
      </p>
      <a href="/" style={{ display: 'inline-block', marginTop: 24, color: '#3b82f6' }}>
        ← Upload a new document
      </a>
    </main>
  )
}
