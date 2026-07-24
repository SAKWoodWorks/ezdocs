# Google Auth via PocketBase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict creator routes to @sakww.com Google accounts using PocketBase as auth backend; signer links stay public.

**Architecture:** PocketBase runs as a Docker Compose sidecar (port 8090) and handles Google OAuth2. Next.js middleware reads a session cookie (PocketBase JWT), validates it against PocketBase on each protected request, and redirects unauthenticated users to `/login`. The OAuth2 PKCE flow runs server-side: Next.js fetches the Google auth URL + codeVerifier from PocketBase, stores the verifier in a short-lived cookie, and exchanges the code at the callback.

**Tech Stack:** PocketBase (`ghcr.io/muchobien/pocketbase:latest`), Next.js 16 middleware, native `fetch` (no new npm packages), httpOnly cookies.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `docker-compose.yml` | Add pocketbase service + pb_data volume |
| Modify | `.env.example` | Document POCKETBASE_URL |
| Modify | `.env.local` | Set POCKETBASE_URL for local dev |
| Create | `src/lib/pocketbase.ts` | PocketBase API helpers: get auth URL, exchange code, validate token |
| Create | `src/middleware.ts` | Protect creator routes; redirect to /login if no valid session |
| Create | `src/app/login/page.tsx` | Login page with "Sign in with Google" button |
| Create | `src/app/api/auth/login/route.ts` | Fetch Google auth URL from PocketBase, set verifier cookie, redirect |
| Create | `src/app/api/auth/callback/route.ts` | Exchange code+verifier, check @sakww.com, set session cookie |
| Create | `src/app/api/auth/logout/route.ts` | Clear session cookie, redirect to /login |
| Modify | `src/app/page.tsx` | Add logout button |
| Modify | `src/app/prepare/[uuid]/page.tsx` | Add logout button on done screen |

---

## Task 1: Docker Compose + Environment Variables

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Add PocketBase service to docker-compose.yml**

Replace contents of `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/uploads
    environment:
      - UPLOAD_DIR=/app/uploads
      - BASE_URL=http://localhost:3000
      - MAX_FILE_SIZE_MB=20
      - POCKETBASE_URL=http://pocketbase:8090
    depends_on:
      - pocketbase
    restart: unless-stopped

  pocketbase:
    image: ghcr.io/muchobien/pocketbase:latest
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
    restart: unless-stopped

volumes:
  uploads:
  pb_data:
```

- [ ] **Step 2: Update .env.example**

Append to `.env.example`:
```
POCKETBASE_URL=http://localhost:8090
```

- [ ] **Step 3: Update .env.local**

Append to `.env.local`:
```
POCKETBASE_URL=http://localhost:8090
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example .env.local
git commit -m "chore: add PocketBase service to Docker Compose"
```

---

## Task 2: PocketBase Helper Library

**Files:**
- Create: `src/lib/pocketbase.ts`

This module wraps all PocketBase API calls. No npm package — uses native fetch.

PocketBase OAuth2 flow used here:
- `GET /api/collections/users/auth-methods` → returns `authProviders[].{ name, authUrl, codeVerifier, state }`
  The `authUrl` ends with `&redirectUrl=` — append your callback URL to complete it.
- `POST /api/collections/users/auth-with-oauth2-code` → exchange code for token + user record
- `POST /api/collections/users/auth-refresh` (with `Authorization: Bearer {token}`) → validate token

- [ ] **Step 1: Create `src/lib/pocketbase.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/pocketbase.ts
git commit -m "feat: PocketBase auth helper library"
```

---

## Task 3: Auth API Routes

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/callback/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

Cookie names used throughout:
- `pb_verifier` — httpOnly, 5min TTL, stores codeVerifier for PKCE
- `pb_token` — httpOnly, 30-day TTL, stores PocketBase JWT

- [ ] **Step 1: Create login route `src/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/pocketbase'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const callbackUrl = new URL('/api/auth/callback', req.nextUrl.origin).toString()
  try {
    const { authUrl, codeVerifier } = await getGoogleAuthUrl(callbackUrl)
    const res = NextResponse.redirect(authUrl)
    res.cookies.set('pb_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/',
    })
    return res
  } catch (err) {
    console.error('Auth init error:', err)
    return NextResponse.redirect(new URL('/login?error=init', req.nextUrl.origin))
  }
}
```

- [ ] **Step 2: Create callback route `src/app/api/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { exchangeOAuth2Code } from '@/lib/pocketbase'

const ALLOWED_DOMAIN = '@sakww.com'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const codeVerifier = req.cookies.get('pb_verifier')?.value

  if (!code || !codeVerifier) {
    return NextResponse.redirect(new URL('/login?error=missing', origin))
  }

  const callbackUrl = new URL('/api/auth/callback', origin).toString()

  try {
    const { token, record } = await exchangeOAuth2Code(code, codeVerifier, callbackUrl)

    if (!record.email.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.redirect(new URL('/login?error=domain', origin))
    }

    const res = NextResponse.redirect(new URL('/', origin))
    res.cookies.set('pb_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    res.cookies.delete('pb_verifier')
    return res
  } catch (err) {
    console.error('Auth callback error:', err)
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }
}
```

- [ ] **Step 3: Create logout route `src/app/api/auth/logout/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  res.cookies.delete('pb_token')
  return res
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: auth API routes — login, callback, logout"
```

---

## Task 4: Login Page

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Create `src/app/login/page.tsx`**

```typescript
import { Suspense } from 'react'
import LoginContent from './LoginContent'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: Create `src/app/login/LoginContent.tsx`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat: login page with Google sign-in button"
```

---

## Task 5: Middleware

**Files:**
- Create: `src/middleware.ts`

Middleware in Next.js 16 runs on Edge Runtime. Validates session cookie by calling PocketBase on each protected request.

Protected routes:
- `/` (upload page)
- `/prepare/*`
- `/stamps`
- `/api/upload`
- `/api/prepare/*`
- `/api/stamps` and `/api/stamps/*`

Public routes (no auth):
- `/login`
- `/sign/*`
- `/api/auth/*`
- `/api/doc/*`
- `/api/sign/*`
- `/api/download/*`
- `/api/status/*`

- [ ] **Step 1: Create `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PATTERNS = [
  /^\/$/,
  /^\/prepare\//,
  /^\/stamps/,
  /^\/api\/upload$/,
  /^\/api\/prepare\//,
  /^\/api\/stamps/,
]

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(p => p.test(pathname))
}

async function validateToken(token: string, pbUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${pbUrl}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  if (!isProtected(pathname)) return NextResponse.next()

  const token = req.cookies.get('pb_token')?.value
  const pbUrl = process.env.POCKETBASE_URL ?? 'http://localhost:8090'

  if (!token || !(await validateToken(token, pbUrl))) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete('pb_token')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: clean build, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: auth middleware — protect creator routes"
```

---

## Task 6: Logout Button

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/prepare/[uuid]/page.tsx`

- [ ] **Step 1: Read current `src/app/page.tsx`**

Check current contents — it should be a simple upload page.

- [ ] **Step 2: Add logout button to `src/app/page.tsx`**

Add to the top-right of the page (after `<main>` opening tag):

```typescript
<div style={{ position: 'fixed', top: 16, right: 20 }}>
  <a
    href="/api/auth/logout"
    style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
  >
    Sign out
  </a>
</div>
```

- [ ] **Step 3: Add logout button to prepare page done screen**

In `src/app/prepare/[uuid]/page.tsx`, in the `if (done)` return block, add sign-out link below the existing content:

```typescript
<p style={{ color: '#4b5563', fontSize: 12, marginTop: 32 }}>
  <a href="/api/auth/logout" style={{ color: '#6b7280', textDecoration: 'none' }}>Sign out</a>
</p>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/prepare/
git commit -m "feat: add sign-out link to upload and prepare pages"
```

---

## Task 7: PocketBase Admin Setup (Manual Steps)

This task is manual — no code changes.

- [ ] **Step 1: Start PocketBase**

```bash
docker compose up -d pocketbase
```

- [ ] **Step 2: Create admin account**

Open `http://localhost:8090/_/` in browser. Create an admin email + password.

- [ ] **Step 3: Enable Google OAuth2**

In PocketBase admin:
1. Go to **Settings → Auth Providers**
2. Enable **Google**
3. Paste **Client ID** and **Client Secret** from Google Cloud Console
4. Save

- [ ] **Step 4: Configure Google Cloud Console**

In [Google Cloud Console](https://console.cloud.google.com/):
1. Create OAuth2 credentials (Web application)
2. Add authorized redirect URI: `http://localhost:8090/api/oauth2-redirect` (dev)
   For production: `http://<server-ip>:8090/api/oauth2-redirect`
3. Copy Client ID + Secret into PocketBase admin (Step 3)

- [ ] **Step 5: Test login flow**

```bash
docker compose up -d
```

Open `http://localhost:3000` — should redirect to `/login`. Click "Sign in with Google", use a @sakww.com account. Should land on `/` after auth. Try a non-@sakww.com account — should redirect to `/login?error=domain`.

---

## Task 8: Final Build + Push

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: clean, all routes listed including `/login` and `/api/auth/*`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: existing tests pass (auth code has no unit tests — it's integration-only).

- [ ] **Step 3: Push**

```bash
git push
```

---

## Post-Deploy Notes

- PocketBase admin UI is on port 8090. For production, do **not** expose 8090 publicly. Use a firewall rule or nginx to block external access to 8090.
- Stamp and upload data survive container restarts via named Docker volumes (`uploads`, `pb_data`).
- PocketBase tokens expire after 7 days by default. The `auth-refresh` call in middleware auto-extends the token on each request.
