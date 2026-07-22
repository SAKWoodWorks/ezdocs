import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import type { SignatureZone } from '@/lib/types'

export async function embedSignature(
  docPath: string,
  signaturePngPath: string,
  outputPath: string,
  zones: SignatureZone[],
): Promise<void> {
  const pdfBytes = await fs.promises.readFile(docPath)
  const sigBytes = await fs.promises.readFile(signaturePngPath)

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const sigImage = await pdfDoc.embedPng(sigBytes)
  const pages = pdfDoc.getPages()

  for (const zone of zones) {
    const pageIndex = Math.max(0, Math.min(zone.page - 1, pages.length - 1))
    const page = pages[pageIndex]
    const { height: pageHeight } = page.getSize()
    const pdfY = pageHeight - zone.y - zone.height
    page.drawImage(sigImage, {
      x: zone.x,
      y: pdfY,
      width: zone.width,
      height: zone.height,
    })
  }

  const signedBytes = await pdfDoc.save()
  await fs.promises.writeFile(outputPath, signedBytes)
}
