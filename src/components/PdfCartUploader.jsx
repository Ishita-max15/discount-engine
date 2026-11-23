
import { useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

function groupTextByLine(items) {
  const lines = []

  const sortedItems = items
    .filter(item => item.str?.trim())
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4] + (item.width || 0) / 2,
      y: item.transform[5],
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  for (const item of sortedItems) {
    let line = lines.find(existing => Math.abs(existing.y - item.y) < 3)

    if (!line) {
      line = { y: item.y, items: [] }
      lines.push(line)
    }

    line.items.push(item)
  }

  return lines.map(line => ({
    y: line.y,
    items: line.items.sort((a, b) => a.x - b.x),
  }))
}

function findHeaderColumns(lines) {
  for (const line of lines) {
    const headers = []

    for (const item of line.items) {
      const text = item.text.toLowerCase().replace(/[^a-z]/g, '')

      if (text.includes('product')) {
        headers.push({ name: 'product', x: item.x })
      } else if (text.includes('brand')) {
        headers.push({ name: 'brand', x: item.x })
      } else if (text.includes('platform')) {
        headers.push({ name: 'platform', x: item.x })
      } else if (text.includes('baseprice') || text === 'price') {
        headers.push({ name: 'basePrice', x: item.x })
      } else if (text === 'itemid' || text === 'id') {
        headers.push({ name: 'itemId', x: item.x })
      }
    }

    const required = ['product', 'brand', 'platform', 'basePrice']
    const found = required.every(name =>
      headers.some(header => header.name === name)
    )

    if (found) {
      return { headerLine: line, headers: headers.sort((a, b) => a.x - b.x) }
    }
  }

  return null
}

function extractRowsFromLines(lines) {
  const headerInfo = findHeaderColumns(lines)

  if (!headerInfo) {
    throw new Error(
      'Could not find the required table headings. The PDF must contain Product, Brand, Platform and Base Price columns.'
    )
  }

  const { headerLine, headers } = headerInfo

  const boundaries = headers.map((header, index) => {
    const next = headers[index + 1]
    return next ? (header.x + next.x) / 2 : Infinity
  })

  const rows = lines.filter(line => line.y < headerLine.y - 2)
  const cartItems = []

  for (const line of rows) {
    const values = {}

    for (const item of line.items) {
      const columnIndex = boundaries.findIndex(boundary => item.x < boundary)
      if (columnIndex === -1) continue

      const columnName = headers[columnIndex].name
      values[columnName] = values[columnName]
        ? `${values[columnName]} ${item.text}`
        : item.text
    }

    const product = values.product?.trim()
    const brand = values.brand?.trim()
    const platform = values.platform?.trim()
    const rawPrice = values.basePrice?.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '')
    const basePrice = Number(rawPrice)

    if (!product && !brand && !platform && !rawPrice) continue

    if (!product || !brand || !platform || !Number.isFinite(basePrice) || basePrice <= 0) {
      continue
    }

    cartItems.push({
      itemId: values.itemId?.trim() || `PDF-${String(cartItems.length + 1).padStart(3, '0')}`,
      product,
      brand,
      platform,
      basePrice: Math.round(basePrice),
    })
  }

  return cartItems
}

async function parsePDF(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
  }).promise

  const allCartItems = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines = groupTextByLine(content.items)

    const pageItems = extractRowsFromLines(lines)
    allCartItems.push(...pageItems)
  }

  if (allCartItems.length === 0) {
    throw new Error('No valid cart items were found in this PDF.')
  }

  return allCartItems
}

export default function PdfCartUploader({
  onLoad,
  hasData,
  fileName,
}) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(event) {
    const file = event.target.files[0]
    if (!file) return

    setError('')

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      event.target.value = ''
      return
    }

    try {
      setLoading(true)

      const cartItems = await parsePDF(file)
      onLoad(cartItems, file.name)
    } catch (err) {
      console.error('PDF upload error:', err)
      setError(err.message || 'Unable to read this PDF.')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div>
      <div
        style={{
          border: `2px dashed ${hasData ? '#1e5c2c' : '#CECECE'}`,
          borderRadius: 6,
          padding: '1rem 1.2rem',
          background: hasData ? '#f0faf2' : '#fafafa',
          cursor: loading ? 'wait' : 'pointer',
        }}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: 20 }}>
            {loading ? '⏳' : hasData ? '✅' : '📄'}
          </span>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#131A48' }}>
              Cart PDF
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              {loading
                ? 'Reading PDF...'
                : hasData
                  ? fileName
                  : 'Upload a PDF containing your cart table'}
            </div>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: hasData ? '#1e5c2c' : '#FF5800',
                textTransform: 'uppercase',
              }}
            >
              {loading ? 'Please wait' : hasData ? 'Change' : 'Upload'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ color: '#c62828', fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  )
}
