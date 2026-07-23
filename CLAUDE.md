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
2. **Prepare** (`/prepare/[uuid]` → `POST /api/prepare/[uuid]`) — user drags signature zones onto PDF pages; zones saved to `meta.json`
3. **Sign** (`/sign/[uuid]` → `POST /api/sign/[uuid]`) — canvas signature captured, embedded into PDF via pdf-lib at stored zones, output written as `signed.pdf`

**File storage layout** (one folder per document):
```
{UPLOAD_DIR}/{uuid}/
  original.{ext}   — uploaded file
  document.pdf     — converted PDF (served at GET /api/doc/:uuid)
  signed.pdf       — final output (served at GET /api/download/:uuid)
  meta.json        — { createdAt, expiresAt, originalName, signed, signatureZones }
```

`signatureZones` elements: `{ page: number, x, y, width, height }` — page is 0-indexed.

**Key modules:**
- `src/lib/storage.ts` — UUID validation, path helpers, meta.json read/write
- `src/lib/convert.ts` — LibreOffice conversion wrapper
- `src/lib/embed-signature.ts` — pdf-lib signature rendering
- `src/lib/cleanup.ts` — node-cron job, purges folders older than 7 days; started in `src/app/layout.tsx`

**Environment variables** (see `.env.example`):
- `UPLOAD_DIR` — absolute path for uploaded files (required)
- `BASE_URL` — used for sharing links
- `MAX_FILE_SIZE_MB` — upload size cap (default 20)

**Tests** run in Node environment (not jsdom). Path alias `@/` maps to `src/`.

**Canvas** is disabled in Webpack config (`canvas: false`) — react-signature-canvas uses browser canvas only.

**Deployment**: Docker (LibreOffice installed in image) or PM2 (`ecosystem.config.js`, port 3001).
