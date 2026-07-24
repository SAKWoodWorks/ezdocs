'use client'
import { useSearchParams } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  domain: 'Only @sakww.com accounts are allowed.',
  auth: 'Authentication failed. Please try again.',
  init: 'Could not connect to auth provider. Please try again.',
  missing: 'Authentication incomplete. Please try again.',
}

export default function LoginContent() {
  const params = useSearchParams()
  const error = params.get('error')

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0a0a0a',
    }}>
      <div style={{
        background: '#111', border: '1px solid #222', borderRadius: 12,
        padding: '48px 40px', textAlign: 'center', maxWidth: 360, width: '100%',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#f9fafb' }}>
          EZDocs
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>
          Sign in with your @sakww.com account
        </p>

        {error && (
          <p style={{
            color: '#ef4444', fontSize: 13, marginBottom: 20,
            background: '#1f0000', padding: '10px 16px', borderRadius: 6,
          }}>
            {ERROR_MESSAGES[error] ?? 'An error occurred.'}
          </p>
        )}

        <a
          href="/api/auth/login"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '12px 24px', background: '#fff', color: '#111',
            borderRadius: 8, textDecoration: 'none', fontSize: 15, fontWeight: 500,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        </a>
      </div>
    </main>
  )
}
