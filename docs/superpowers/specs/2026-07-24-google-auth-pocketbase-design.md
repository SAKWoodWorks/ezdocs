# Google Auth via PocketBase — Design Spec

**Date:** 2026-07-24  
**Status:** Approved

## Goal

Restrict creator actions (upload, prepare, stamp management) to @sakww.com Google accounts. Signer links remain public — external signers do not need a Google account.

## Infrastructure

Add PocketBase as a second Docker Compose service:

```yaml
pocketbase:
  image: ghcr.io/muchobien/pocketbase:latest
  ports: ["8090:8090"]
  volumes: [pb_data:/pb/pb_data]
```

PocketBase runs on port 8090. Next.js reaches it at `http://pocketbase:8090` inside Docker (`http://localhost:8090` in dev).

New env vars:
- `POCKETBASE_URL` — internal URL to PocketBase (e.g. `http://pocketbase:8090`)

## One-Time Admin Setup (not code)

After first deploy:
1. Open `http://<server>:8090/_/` → create admin account
2. Settings → Auth Providers → enable Google OAuth2
3. Paste Google Cloud OAuth2 client ID + secret
4. Set authorized redirect URI in Google Cloud Console: `{POCKETBASE_URL}/api/oauth2-redirect`
5. Set redirect URL in PocketBase to `{BASE_URL}/api/auth/callback`

## Auth Flow

```
User → protected route
  → middleware: no session cookie → redirect /login

/login page
  → click "Sign in with Google"
  → POST /api/auth/login
    → fetch PocketBase auth methods → get Google authUrl + codeVerifier
    → store codeVerifier in httpOnly cookie (short TTL)
    → redirect browser to Google authUrl

Google → user authorizes → PocketBase /api/oauth2-redirect
  → PocketBase exchanges code → redirects to /api/auth/callback?code=&state=

/api/auth/callback
  → read codeVerifier from cookie
  → POST PocketBase /api/collections/users/auth-with-oauth2-code
  → get { token, record: { email } }
  → if !email.endsWith('@sakww.com') → redirect /login?error=domain
  → store token in httpOnly session cookie (30-day TTL)
  → redirect /

Middleware (every protected request)
  → read session cookie
  → GET PocketBase /api/collections/users/auth-refresh (validates + refreshes token)
  → if invalid → clear cookie, redirect /login
  → if valid → proceed
```

## Protected vs Public Routes

**Protected** (require valid @sakww.com session):
- `GET /`
- `GET /prepare/[uuid]`
- `GET /stamps`
- `POST /api/upload`
- `POST /api/prepare/[uuid]`
- `GET|POST /api/stamps`
- `GET|DELETE /api/stamps/[id]`

**Public** (no auth required — signer access):
- `GET /login`
- `GET /sign/[uuid]`
- `POST /api/sign/[uuid]`
- `GET /api/doc/[uuid]`
- `GET /api/download/[uuid]`
- `GET /api/status/[uuid]`

## New Files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Route-level auth guard, redirects to /login |
| `src/lib/pocketbase.ts` | PocketBase API helpers (getAuthUrl, exchangeCode, validateToken) |
| `src/app/login/page.tsx` | Login page with "Sign in with Google" button |
| `src/app/api/auth/login/route.ts` | Initiates OAuth: gets authUrl, sets verifier cookie, redirects |
| `src/app/api/auth/callback/route.ts` | Exchanges code, checks @sakww.com, sets session cookie |
| `src/app/api/auth/logout/route.ts` | Clears session cookie, redirects to /login |

## Modified Files

| File | Change |
|---|---|
| `docker-compose.yml` | Add pocketbase service + pb_data volume |
| `.env.example` | Add POCKETBASE_URL |
| `.env.local` | Add POCKETBASE_URL=http://localhost:8090 |

## Security Notes

- Session cookie: httpOnly, sameSite=lax, secure in production
- codeVerifier cookie: httpOnly, maxAge=5min (PKCE protection)
- Domain check (`@sakww.com`) enforced server-side in callback — not just UI
- Token validated with PocketBase on every protected request (not just decoded locally)
- PocketBase port 8090 should not be exposed publicly in production (internal only)
