/**
 * Server-side file parser for admin TQ uploads.
 * Handles: PDF (pdf-parse), DOCX (mammoth), plain text, images (base64 to AI).
 */

import pdfParse from 'pdf-parse'
import mammoth  from 'mammoth'

/**
 * Extract text from a file buffer based on mimetype.
 * Called by the admin TQ upload route.
 */
export async function extractTextFromBuffer(buffer, mimetype, filename = '') {
  const type = mimetype?.toLowerCase() || ''
  const ext  = filename.split('.').pop()?.toLowerCase() || ''

  // PDF
  if (type.includes('pdf') || ext === 'pdf') {
    const result = await pdfParse(buffer)
    return result.text?.trim() || ''
  }

  // Word document
  if (
    type.includes('wordprocessingml') ||
    type.includes('msword') ||
    ext === 'docx' || ext === 'doc'
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value?.trim() || ''
  }

  // Plain text
  if (type.includes('text/plain') || ext === 'txt') {
    return buffer.toString('utf-8').trim()
  }

  // Fallback — try as plain text
  try {
    const text = buffer.toString('utf-8').trim()
    if (text.length > 20) return text
  } catch {}

  throw new Error(`Unsupported file type: ${mimetype || ext}. Upload PDF, DOCX, or TXT files.`)
}
