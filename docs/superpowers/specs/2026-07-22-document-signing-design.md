# Document Signing System — Design Spec
**Date:** 2026-07-22

## Overview

Standalone Next.js web app for document signing. Users upload a document, place a signature zone, share a link with their manager. Manager opens link, draws signature, saves. Both parties download signed PDF. No database, no login — UUID-based file system.

---

## Core Flow

1. **Upload** — User uploads PDF, DOCX, DOC, JPG, or PNG at `/`
2. **Place Zone** — User drags signature placeholder to desired position on the PDF preview at `/prepare/[uuid]`
3. **Share** — System shows copyable link `yourdomain.com/sign/[uuid]`. User sends via WhatsApp, Line, email, etc.
4. **Sign** — Manager opens link at `/sign/[uuid]`, views PDF, draws signature on canvas with mouse, clicks "Sign & Save"
5. **Download** — Both user and manager can download `signed.pdf` from the same `/sign/[uuid]` page

---

## Architecture

**Stack:** Next.js 14 (App Router), TypeScript, hosted on DigitalOcean Droplet

**Storage:** Local filesystem — no database

```
/uploads/
  {uuid}/
    original.{ext}      — raw uploaded file
    document.pdf        — normalized PDF (converted from DOCX/image if needed)
    signed.pdf          — generated after manager signs
    meta.json           — metadata (see schema below)
```

**meta.json schema:**
```json
{
  "createdAt": "2026-07-22T10:00:00Z",
  "expiresAt": "2026-07-29T10:00:00Z",
  "originalName": "contract.docx",
  "signed": false,
  "signatureZone": null
}
```

`signatureZone` is `null` on creation. Set to coordinates object after user confirms placement on `/prepare/[uuid]`:
```json
"signatureZone": {
  "page": 2,
  "x": 320,
  "y": 680,
  "width": 200,
  "height": 80
}
```

---

## Pages

| Route | Who | Purpose |
|---|---|---|
| `/` | Uploader | Upload file |
| `/prepare/[uuid]` | Uploader | Drag signature zone on PDF, get link |
| `/sign/[uuid]` | Manager (+ Uploader) | View PDF, draw signature, download |

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/upload` | Receive file, convert to PDF, save, return UUID |
| `GET` | `/api/doc/[uuid]` | Stream `document.pdf` to PDF viewer |
| `POST` | `/api/prepare/[uuid]` | Save signature zone coordinates to `meta.json` |
| `POST` | `/api/sign/[uuid]` | Embed signature PNG into PDF at saved coordinates, save `signed.pdf` |
| `GET` | `/api/download/[uuid]` | Stream `signed.pdf` |

---

## Key Libraries

| Library | Purpose |
|---|---|
| `pdf-lib` | Embed signature image into PDF at exact coordinates |
| `libreoffice-convert` | Convert DOCX/DOC → PDF on server |
| `sharp` | Convert JPG/PNG → PDF |
| `react-signature-canvas` | Mouse-drawn signature canvas |
| `react-pdf` (pdfjs-dist) | Render PDF in browser for zone placement and viewing |
| `react-draggable` | Drag signature zone on PDF in `/prepare` |
| `multer` | Handle multipart file upload in API route |
| `node-cron` | Daily cleanup of expired document folders |
| `uuid` | Generate unique document IDs |

---

## Signature Placement

- `/prepare/[uuid]` renders the PDF via `react-pdf`
- Overlay shows draggable yellow dashed box ("Sign here")
- User can switch pages if multi-page document
- On confirm: coordinates (page, x, y, width, height) POST to `/api/prepare/[uuid]` → saved in `meta.json`
- Coordinates are in PDF points (not screen pixels) — converted on client using page scale factor
- After successful POST, same page transitions to "link ready" state — shows copyable link and "Send to manager" instructions (no redirect, no extra page)

---

## Signing Page (`/sign/[uuid]`)

**Before signed:**
- PDF viewer (full document)
- Signature zone highlighted with dashed border
- Signature canvas below (mouse draw)
- "Clear" + "Sign & Save" buttons
- On submit: canvas exports PNG → POST to `/api/sign/[uuid]`

**After signed:**
- PDF viewer shows signed document
- "Download PDF" button
- "Already signed" badge

---

## File Conversion

| Input | Conversion |
|---|---|
| `.pdf` | No conversion needed |
| `.docx` / `.doc` | `libreoffice-convert` → PDF (LibreOffice installed on Droplet) |
| `.jpg` / `.png` | `sharp` → embed in PDF via `pdf-lib` |

All inputs normalized to `document.pdf` before zone placement.

---

## Expiry & Cleanup

- `meta.json` stores `expiresAt` = 7 days after upload
- `node-cron` job runs daily at 02:00 server time
- Deletes any `/uploads/{uuid}/` folder where `expiresAt` is past
- No action needed from user — fully automatic

---

## Error States

| Scenario | Handling |
|---|---|
| UUID not found | 404 page with "Link expired or invalid" |
| File too large (>20MB) | Client-side check before upload, API rejects with 413 |
| Already signed | `/sign/[uuid]` shows download button only, no signature canvas |
| LibreOffice not installed | API returns 500 with clear error; DOCX support optional |
| Upload fails mid-way | Partial folder deleted on error |

---

## Deployment Notes

- Requires LibreOffice installed on Droplet: `apt install libreoffice`
- `/uploads` directory needs write permissions for the app user
- Set `UPLOAD_DIR` env var to absolute path of uploads folder
- Set `BASE_URL` env var for generating share links
- File size limit configurable via `MAX_FILE_SIZE_MB` env var (default: 20)

---

## Out of Scope

- User authentication / accounts
- Email notifications
- Multiple signers
- Signature audit trail
- Document templates
- Mobile-optimized signature drawing (desktop browser only for MVP)
