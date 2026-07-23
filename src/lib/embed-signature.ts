import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import type { SignatureZone, StampZone } from '@/lib/types'

export async function embedSignature(
  docPath: string,
  signaturePngPath: string,
  outputPath: string,
  zones: SignatureZone[],
  stampEntries?: Array<{ zone: StampZone; imageBytes: Buffer }>,
): Promise<void> {
  const pdfBytes = await fs.promises.readFile(docPath)
  const sigBytes = await fs.promises.readFile(signaturePngPath)

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()

  if (stampEntries) {
    for (const { zone, imageBytes } of stampEntries) {
      const stampImage = await pdfDoc.embedPng(imageBytes)
      const pageIndex = Math.max(0, Math.min(zone.page - 1, pages.length - 1))
      const page = pages[pageIndex]
      const { height: pageHeight } = page.getSize()

      // Preserve aspect ratio (like object-fit: contain)
      const { width: natW, height: natH } = stampImage.scale(1)
      const ratio = natW / natH
      let drawW = zone.width
      let drawH = zone.height
      if (ratio > drawW / drawH) {
        drawH = drawW / ratio
      } else {
        drawW = drawH * ratio
      }
      const offsetX = (zone.width - drawW) / 2
      const offsetY = (zone.height - drawH) / 2

      page.drawImage(stampImage, {
        x: zone.x + offsetX,
        y: pageHeight - zone.y - zone.height + offsetY,
        width: drawW,
        height: drawH,
      })
    }
  }

  const sigImage = await pdfDoc.embedPng(sigBytes)
  for (const zone of zones) {
    const pageIndex = Math.max(0, Math.min(zone.page - 1, pages.length - 1))
    const page = pages[pageIndex]
    const { height: pageHeight } = page.getSize()
    page.drawImage(sigImage, {
      x: zone.x,
      y: pageHeight - zone.y - zone.height,
      width: zone.width,
      height: zone.height,
    })
  }

  const signedBytes = await pdfDoc.save()
  await fs.promises.writeFile(outputPath, signedBytes)
}
