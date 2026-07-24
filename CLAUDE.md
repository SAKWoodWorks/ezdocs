# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # dev server (Turbopack)
npm run build     # production build
npm run start     # serve production build (port 3000)
npm run lint      # ESLint
npm run test      # Jest
npm run test:watch

# single test file
npx jest src/lib/storage.test.ts
```

## Architecture

**Document e-signature workflow** — three-step flow:

1. **Upload** (`/` → `POST /api/upload`) — accepts PDF/DOC/DOCX/JPG/PNG (20MB default), converts non-PDFs via LibreOffice, writes UUID-keyed folder to `UPLOAD_DIR`
2. **Prepare** (`/prepare/[uuid]` → `POST /api/prepare/[uuid]`) — creator drags signature + stamp zones per page; zones saved to `meta.json`
3. **Sign** (`/sign/[uuid]` → `POST /api/sign/[uuid]`) — signer draws on canvas; signature + stamps embedded via pdf-lib at stored zones

**File storage layout** (one folder per document):
```
{UPLOAD_DIR}/{uuid}/
  original.{ext}   — uploaded file
  document.pdf     — converted PDF (served at GET /api/doc/:uuid)
  signed.pdf       — final output (served at GET /api/download/:uuid)
  meta.json        — { createdAt, expiresAt, originalName, signed, signatureZones, stampZones }

{UPLOAD_DIR}/stamps/
  {uuid}.png       — company stamp images (served at GET /api/stamps/:id)
```

`signatureZones`: `{ page, x, y, width, height }` — PDF point coordinates (595pt = A4 width).  
`stampZones`: `{ page, stampId, x, y, width, height }` — same coordinate space; stamps embedded with aspect-ratio preservation.

**Key modules:**
- `src/lib/storage.ts` — UUID validation, path helpers, meta.json read/write, stamp path helpers
- `src/lib/convert.ts` — LibreOffice conversion wrapper
- `src/lib/embed-signature.ts` — pdf-lib signature + stamp rendering (stamps use `scale(1)` for natural dims)
- `src/lib/pocketbase.ts` — PocketBase OAuth2 helpers: `getGoogleAuthUrl`, `exchangeOAuth2Code`, `validateToken`
- `src/lib/cleanup.ts` — node-cron job, purges folders older than 7 days; started in `src/app/layout.tsx`

**Auth — Google OAuth2 via PocketBase (PKCE flow):**
- Creator routes protected by `src/middleware.ts` (Next.js proxy/middleware, Edge Runtime)
- Only `@sakww.com` Google accounts allowed — enforced in `src/app/api/auth/callback/route.ts`
- Cookies: `pb_token` (30-day session), `pb_verifier` + `pb_state` (5-min PKCE, cleared after use)
- PocketBase runs as a sidecar Docker service at `http://pocketbase:8090` (internal), port 8090 host-exposed for admin only
- `BASE_URL` env var drives OAuth redirect URIs — must be set to the public HTTPS URL in production (e.g. `https://ezdocs.sakww.com`); falling back to `x-forwarded-proto`/`host` headers

**Protected routes** (require valid session): `/`, `/prepare/[uuid]`, `/stamps`, `/api/upload`, `/api/prepare/[uuid]`, `/api/stamps*`  
**Public routes** (no auth): `/login`, `/sign/[uuid]`, `/api/sign/[uuid]`, `/api/doc/[uuid]`, `/api/download/[uuid]`, `/api/status/[uuid]`

**Sign page extras:**
- Desktop shows QR code of the sign URL so signer can continue on mobile
- Creator's prepare page polls `GET /api/status/[uuid]` every 3s after link is sent; shows download when signed

**Environment variables** (see `.env.example`):
- `UPLOAD_DIR` — absolute path for uploaded files (required)
- `BASE_URL` — public HTTPS URL, used for OAuth redirects and sharing links
- `MAX_FILE_SIZE_MB` — upload size cap (default 20)
- `POCKETBASE_URL` — internal URL to PocketBase (default `http://pocketbase:8090` in Docker)

**Tests** run in Node environment (not jsdom). Path alias `@/` maps to `src/`.

**Canvas** is disabled in Webpack config (`canvas: false`) — react-signature-canvas uses browser canvas only.

**Deployment**: Docker Compose (`docker-compose.yml`) with two services: `app` (port 8009→3000) and `pocketbase` (port 8090). LibreOffice installed in app image. Behind nginx reverse proxy with SSL via certbot.

**PocketBase first-time setup** (new deployment):
1. `docker compose up -d pocketbase`
2. Get install URL: `docker logs <pb-container> 2>&1 | grep pbinstall` — replace `0.0.0.0` with `localhost`
3. Create admin, create `users` collection (Auth type), enable Google OAuth2 with client credentials
4. Set redirect URL in PocketBase Google settings to `{BASE_URL}/api/auth/callback`
5. Add `{BASE_URL}/api/auth/callback` to Google Cloud Console authorized redirect URIs
