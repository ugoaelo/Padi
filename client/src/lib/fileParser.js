/**
 * fileParser.js — shared file-to-text utility used across ExamPage,
 * StudyPacksPage, and PastQuestionsPage.
 *
 * Supported formats:
 *   .txt / .md   → read as plain text (client-side, no deps)
 *   .docx / .doc → extract via mammoth (client-side, lightweight)
 *   .pdf         → send to /api/ai/extract-text (server-side pdf-parse)
 *
 * Usage:
 *   import { parseFile, ACCEPTED_TYPES, ACCEPTED_LABEL } from '../lib/fileParser.js'
 *   const text = await parseFile(file, authFetchFn)
 *   // authFetchFn is the extractPdfText helper exported from aiApi.js
 */

import mammoth from 'mammoth'

/** Accept string for <input type="file" accept="..."> */
export const ACCEPTED_TYPES = '.txt,.md,.docx,.doc,.pdf'

/** Human-readable label */
export const ACCEPTED_LABEL = 'TXT, DOC, DOCX or PDF — max 10 MB'

/**
 * Parse a File object into a plain-text string.
 * @param {File}     file             — the File from an <input type="file">
 * @param {Function} extractPdfText   — async fn(file) => string, from aiApi.js
 * @returns {Promise<string>}
 */
export async function parseFile(file, extractPdfText) {
  if (!file) throw new Error('No file provided.')

  const name = file.name.toLowerCase()
  const MB   = file.size / (1024 * 1024)
  if (MB > 10) throw new Error('File is too large. Please use a file under 10 MB.')

  // ── PDF — server extraction ───────────────────────────────────────
  if (name.endsWith('.pdf')) {
    return await extractPdfText(file)
  }

  // ── DOCX / DOC — mammoth (client-side) ───────────────────────────
  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value?.trim()
    if (!text) throw new Error('Could not extract text from this Word document.')
    return text
  }

  // ── TXT / MD / anything else — plain text ────────────────────────
  const text = await file.text()
  if (!text?.trim()) throw new Error('The file appears to be empty.')
  return text.trim()
}
