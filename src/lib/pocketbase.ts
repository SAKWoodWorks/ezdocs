export interface PocketBaseUser {
  id: string
  email: string
  name: string
  avatarUrl: string
}

export interface PocketBaseAuthResult {
  token: string
  record: PocketBaseUser
}

interface AuthProvider {
  name: string
  state: string
  codeVerifier: string
  authUrl: string
}

function pbUrl(): string {
  const url = process.env.POCKETBASE_URL
  if (!url) throw new Error('POCKETBASE_URL env var not set')
  return url
}

export async function getGoogleAuthUrl(callbackUrl: string): Promise<{
  authUrl: string
  codeVerifier: string
  state: string
}> {
  const res = await fetch(`${pbUrl()}/api/collections/users/auth-methods`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch PocketBase auth methods')
  const data = await res.json()
  const providers: AuthProvider[] = data.authProviders ?? []
  const google = providers.find(p => p.name === 'google')
  if (!google) throw new Error('Google OAuth2 not configured in PocketBase')
  return {
    authUrl: google.authUrl + encodeURIComponent(callbackUrl),
    codeVerifier: google.codeVerifier,
    state: google.state,
  }
}

export async function exchangeOAuth2Code(
  code: string,
  codeVerifier: string,
  callbackUrl: string,
): Promise<PocketBaseAuthResult> {
  const res = await fetch(
    `${pbUrl()}/api/collections/users/auth-with-oauth2-code`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        code,
        codeVerifier,
        redirectUrl: callbackUrl,
      }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'OAuth2 code exchange failed')
  }
  return res.json()
}

export async function validateToken(token: string): Promise<PocketBaseUser | null> {
  try {
    const res = await fetch(
      `${pbUrl()}/api/collections/users/auth-refresh`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const data: PocketBaseAuthResult = await res.json()
    return data.record
  } catch {
    return null
  }
}
