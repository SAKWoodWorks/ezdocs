import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

export async function convertToPdf(srcPath: string, destPath: string, ext: string): Promise<void> {
  const normalizedExt = ext.toLowerCase()

  if (normalizedExt === '.pdf') {
    fs.copyFileSync(srcPath, destPath)
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
  const imgBuffer = await sharp(srcPath).png().toBuffer()
  const { width, height } = await sharp(srcPath).metadata()
  if (!width || !height) throw new Error('Cannot read image dimensions')

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([width, height])
  const img = await pdfDoc.embedPng(imgBuffer)
  page.drawImage(img, { x: 0, y: 0, width, height })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync(destPath, pdfBytes)
}

async function convertDocxToPdf(srcPath: string, destPath: string): Promise<void> {
  // libreoffice-convert uses callbacks — promisify
  const libreoffice = await import('libreoffice-convert')
  const convert = libreoffice.default?.convert ?? libreoffice.convert

  const inputBuffer = fs.readFileSync(srcPath)
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    convert(inputBuffer, '.pdf', undefined, (err: Error | null, result: Buffer) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
  fs.writeFileSync(destPath, pdfBuffer)
}
