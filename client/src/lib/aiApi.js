import { supabase } from './supabase.js'
import { AI_DAILY_LIMIT, getStoredAIRemaining, storeAIRemaining } from './aiQuota.js'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Re-export so callers who import from aiApi still work
export { AI_DAILY_LIMIT, getStoredAIRemaining }

// ── Base authenticated fetch (10 s timeout) ───────────────────────
async function authFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...options.headers },
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.code === 'SUBSCRIPTION_PAUSED') {
        window.dispatchEvent(new CustomEvent('padi:subscription-paused', { detail: { pausedUntil: data.pausedUntil } }))
      }
      const err = new Error(data.error || 'Request failed')
      err.status     = res.status
      err.code       = data.code || null
      err.retryAfter = data.retryAfter || null
      err.pausedUntil = data.pausedUntil || null
      throw err
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — check your connection')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── AI-specific fetch: tracks quota from rate-limit headers ───────
// Also adds a slow-response callback for heavy tasks (study packs, exams).
// onSlow() fires after `slowAfterMs` ms if the request is still pending.
async function aiFetch(path, options = {}, { onSlow, slowAfterMs = 3500 } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  let slowTimer
  if (onSlow) slowTimer = setTimeout(onSlow, slowAfterMs)

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...options.headers },
    })
  } finally {
    if (slowTimer) clearTimeout(slowTimer)
  }

  // ── Capture remaining daily sessions from rate-limit headers ────
  // express-rate-limit standardHeaders sends RateLimit-Remaining.
  // We read from the daily limiter (the second one applied), which
  // overwrites the burst limiter's header value.
  const remaining = res.headers.get('RateLimit-Remaining')
  if (remaining !== null) storeAIRemaining(parseInt(remaining, 10))

  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.status     = res.status
    err.code       = data.code || null
    err.retryAfter = data.retryAfter || null
    // Mark as daily limit vs burst limit so UI can show the right message
    err.isDailyLimit = res.status === 429 && getStoredAIRemaining() === 0
    if (res.status === 429) storeAIRemaining(0)
    throw err
  }
  return data
}

// AI endpoints — use aiFetch so quota is tracked via response headers
// explainTopic passes useWebSearch flag when provided in body
export const explainTopic   = (body, opts) => aiFetch('/api/ai/explain',       { method: 'POST', body: JSON.stringify(body) }, opts)
export const solveMath      = (body, opts) => aiFetch('/api/ai/math',           { method: 'POST', body: JSON.stringify(body) }, opts)
export const generatePack   = (body, opts) => aiFetch('/api/ai/study-pack',     { method: 'POST', body: JSON.stringify(body) }, { slowAfterMs: 3000, ...opts })
export const summariseNotes = (body, opts) => aiFetch('/api/ai/summarise',      { method: 'POST', body: JSON.stringify(body) }, { slowAfterMs: 3000, ...opts })
export const refineAnswer   = (body, opts) => aiFetch('/api/ai/refine',         { method: 'POST', body: JSON.stringify(body) }, opts)
export const deleteStudyPack = (packId)    => authFetch(`/api/ai/study-packs/${packId}`, { method: 'DELETE' })
export const flagAnswer     = (body)       => authFetch('/api/ai/flag',           { method: 'POST', body: JSON.stringify(body) })
export const saveToLibrary  = (body)       => authFetch('/api/ai/save-to-library',{ method: 'POST', body: JSON.stringify(body) })
export const getLibrary     = ()           => authFetch('/api/ai/library')

// ── PDF text extraction (multipart upload, 30 s timeout for large files) ──
export async function extractPdfText(file) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 30_000)
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/api/ai/extract-text`, {
      method:  'POST',
      signal:  controller.signal,
      headers: { Authorization: `Bearer ${session.access_token}` },
      // No Content-Type header — browser sets multipart boundary automatically
      body: form,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to extract PDF text.')
    return data.text
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('PDF extraction timed out. Try a smaller file.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Exam API ──────────────────────────────────────────────────────
export const generateExam         = (body, opts) => aiFetch('/api/exam/generate',                { method: 'POST', body: JSON.stringify(body) }, { slowAfterMs: 3000, ...opts })
export const submitExam           = (body, opts) => aiFetch('/api/exam/submit',                  { method: 'POST', body: JSON.stringify(body) }, opts)
export const saveExamProgress     = (sessionId, body) => authFetch(`/api/exam/${sessionId}/progress`, { method: 'PATCH', body: JSON.stringify(body) })
export const getIncompleteExam    = ()           => authFetch('/api/exam/incomplete')
export const getExamHistory       = ()           => authFetch('/api/exam/history')
export const analysePastQuestions = (body, opts) => aiFetch('/api/exam/past-questions/analyse',  { method: 'POST', body: JSON.stringify(body) }, { slowAfterMs: 3000, ...opts })
export const predictQuestions     = (body, opts) => aiFetch('/api/exam/past-questions/predict',  { method: 'POST', body: JSON.stringify(body) }, { slowAfterMs: 3000, ...opts })

// ── Review / Spaced Repetition API ───────────────────────────────
export const getReviewItems   = ()     => authFetch('/api/review/items')
export const getReviewStats   = ()     => authFetch('/api/review/stats')
export const submitReviewAnswer = (body) => authFetch('/api/review/answer', { method: 'POST', body: JSON.stringify(body) })
export const scheduleForReview = (body) => authFetch('/api/review/schedule', { method: 'POST', body: JSON.stringify(body) })
export const generateRecall   = (body) => authFetch('/api/review/recall',   { method: 'POST', body: JSON.stringify(body) })

// ── Admin API ─────────────────────────────────────────────────────
export const getAdminStats     = ()     => authFetch('/api/admin/stats')
export const getAdminUsers     = ()     => authFetch('/api/admin/users')
export const getAdminWaitlist  = ()     => authFetch('/api/admin/waitlist')
export const getFlaggedAnswers = ()     => authFetch('/api/admin/flagged')
export const reviewFlag        = (id)   => authFetch(`/api/admin/flagged/${id}/review`, { method: 'POST' })
export const batchUpload       = (body) => authFetch('/api/admin/batch-upload',    { method: 'POST', body: JSON.stringify(body) })
export const getKnowledgeBase  = ()     => authFetch('/api/admin/knowledge-base')
export const deleteKbDoc       = (id)   => authFetch(`/api/admin/knowledge-base/${id}`, { method: 'DELETE' })
export const setUserAdmin      = (id, isAdmin) => authFetch(`/api/admin/users/${id}/set-admin`, { method: 'PATCH', body: JSON.stringify({ isAdmin }) })
