'use client'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  url: string
  currentPage: number
  onPageCount?: (count: number) => void
  onRenderSuccess?: () => void
  width?: number
  children?: React.ReactNode
}

export default function PdfViewer({ url, currentPage, onPageCount, onRenderSuccess, width = 600, children }: Props) {
  const [pageCount, setPageCount] = useState(0)

  function onLoadSuccess({ numPages }: { numPages: number }) {
    setPageCount(numPages)
    onPageCount?.(numPages)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Document file={url} onLoadSuccess={onLoadSuccess}>
        <Page pageNumber={currentPage} width={width} onRenderSuccess={onRenderSuccess} />
      </Document>
      {children}
    </div>
  )
}
