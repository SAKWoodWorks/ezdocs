import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import type { SignatureZone } from '@/lib/types'

export async function embedSignature(
  docPath: string,
  signaturePngPath: string,
  outputPath: string,
  zone: SignatureZone,
): Promise<void> {
  const pdfBytes = fs.readFileSync(docPath)
  const sigBytes = fs.readFileSync(signaturePngPath)

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const sigImage = await pdfDoc.embedPng(sigBytes)

  const pages = pdfDoc.getPages()
  // zone.page is 1-indexed
  const pageIndex = Math.max(0, Math.min(zone.page - 1, pages.length - 1))
  const page = pages[pageIndex]
  const { height: pageHeight } = page.getSize()

  // pdf-lib origin is bottom-left; zone coords are top-left origin
  const pdfY = pageHeight - zone.y - zone.height

  page.drawImage(sigImage, {
    x: zone.x,
    y: pdfY,
    width: zone.width,
    height: zone.height,
  })

  const signedBytes = await pdfDoc.save()
  fs.writeFileSync(outputPath, signedBytes)
}
