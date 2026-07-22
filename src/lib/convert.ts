// src/lib/convert.ts
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

export async function convertToPdf(srcPath: string, destPath: string, ext: string): Promise<void> {
  const normalizedExt = ext.toLowerCase()

  if (normalizedExt === '.pdf') {
    await fs.promises.copyFile(srcPath, destPath)
    return
  }

  if (normalizedExt === '.jpg' || normalizedExt === '.jpeg' || normalizedExt === '.png') {
    await convertImageToPdf(srcPath, destPath)
    return
  }

  if (normalizedExt === '.docx' || normalizedExt === '.doc') {
    await convertDocxToPdf(srcPath, destPath)
    return
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

async function convertImageToPdf(srcPath: string, destPath: string): Promise<void> {
  const image = sharp(srcPath)
  const { width, height } = await image.metadata()
  if (!width || !height) throw new Error('Cannot read image dimensions')

  const imgBuffer = await image.png().toBuffer()

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])
  const img = await pdfDoc.embedPng(imgBuffer)
  page.drawImage(img, { x: 0, y: 0, width, height })

  const pdfBytes = await pdfDoc.save()
  await fs.promises.writeFile(destPath, pdfBytes)
}

async function convertDocxToPdf(srcPath: string, destPath: string): Promise<void> {
  const libreoffice = await import('libreoffice-convert')
  const convert = libreoffice.default?.convert ?? libreoffice.convert

  const inputBuffer = await fs.promises.readFile(srcPath)
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    convert(inputBuffer, '.pdf', undefined, (err: Error | null, result: Buffer) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
  await fs.promises.writeFile(destPath, pdfBuffer)
}
