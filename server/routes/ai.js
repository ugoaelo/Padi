import { Router } from 'express'
import { createRequire } from 'module'
import multer from 'multer'
import { requireAuth, requireSubscription, requirePremium } from '../middleware/auth.js'
import { aiLimiter, aiDailyLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { generateAnswer, solveMath, summariseDocument, generateStudyPack, streamAnthropic } from '../services/ai.js'
import { saveUserDocument } from '../services/userContext.js'
import { searchWeb, formatWebContext } from '../services/webSearch.js'

// pdf-parse is CommonJS — use createRequire for ESM compatibility
const require = createRequire(import.meta.url)
let pdfParse
try { pdfParse = require('pdf-parse') } catch (_e) { pdfParse = null }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

const router = Router()

// ── POST /api/ai/extract-text ─────────────────────────────────────
// Extracts plain text from an uploaded PDF. .txt and .docx are
// handled client-side (mammoth); only PDFs need the server.
// Not subject to AI rate limits — no Anthropic API call is made.
router.post('/extract-text', requireAuth, requireSubscription, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' })
  if (!pdfParse)  return res.status(503).json({ error: 'PDF extraction not available — run npm install in /server.' })

  const mime = req.file.mimetype
  const name = req.file.originalname?.toLowerCase() || ''

  if (!mime.includes('pdf') && !name.endsWith('.pdf')) {
    return res.status(400).json({ error: 'Only PDF files are supported on this endpoint.' })
  }

  try {
    const data = await pdfParse(req.file.buffer)
    const text = data.text?.trim()
    if (!text) return res.status(422).json({ error: 'Could not extract any text from this PDF. It may be scanned or image-only.' })
    res.json({ text, pages: data.numpages })
  } catch (err) {
    console.error('PDF extract error:', err)
    res.status(500).json({ error: 'Failed to extract text from PDF. Try a different file or paste the text manually.' })
  }
})

// Apply AI-specific rate limits to all routes below this line
router.use(requireAuth, requireSubscription, aiLimiter, aiDailyLimiter)

// POST /api/ai/explain — topic explanation
// Accepts optional useWebSearch: true to enrich context with live web results.
router.post('/explain', requirePremium, async (req, res) => {
  const { topic, subject, useWebSearch } = req.body
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic is required.' })
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('course, university').eq('id', req.user.id).single()

    let webContext = ''
    let webSearchUsed = false
    let webSearchLimitReached = false

    if (useWebSearch) {
      // ── Web search sub-limit: 20 searches per user per day ────────
      const WEB_SEARCH_DAILY_LIMIT = 20
      const today = new Date().toISOString().split('T')[0]

      const { data: prefs } = await supabaseAdmin
        .from('user_preferences')
        .select('web_search_today, web_search_date')
        .eq('user_id', req.user.id)
        .maybeSingle()

      const searchesToday = (prefs?.web_search_date === today) ? (prefs?.web_search_today || 0) : 0

      if (searchesToday >= WEB_SEARCH_DAILY_LIMIT) {
        webSearchLimitReached = true
      } else {
        try {
          const searchData = await searchWeb(`${topic} ${subject || profile?.course || ''}`.trim())
          webContext    = formatWebContext(searchData)
          webSearchUsed = true

          // Increment counter (fire-and-forget)
          await supabaseAdmin
            .from('user_preferences')
            .upsert({
              user_id:           req.user.id,
              web_search_today:  searchesToday + 1,
              web_search_date:   today,
              updated_at:        new Date().toISOString(),
            }, { onConflict: 'user_id' })
        } catch (searchErr) {
          // Web search is non-fatal — log and continue without it
          console.warn('Web search failed, continuing without:', searchErr.message)
        }
      }
    }

    const result = await generateAnswer({
      question:   webContext ? `${topic}\n\n${webContext}` : topic,
      course:     subject || profile?.course,
      university: profile?.university,
      userId:     req.user.id,
    })
    res.json({ response: result.text, fromCache: result.fromCache || false, webSearchUsed, webSearchLimitReached })
  } catch (err) {
    console.error('Explain error:', err)
    res.status(500).json({ error: 'Failed to generate explanation. Please try again.' })
  }
})

// POST /api/ai/math — step-by-step math solver
router.post('/math', requirePremium, async (req, res) => {
  const { problem, subject } = req.body
  if (!problem?.trim()) return res.status(400).json({ error: 'Problem is required.' })
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('course').eq('id', req.user.id).single()
    const result = await solveMath({ problem, course: subject || profile?.course })
    res.json({ response: result.text })
  } catch (err) {
    console.error('Math error:', err)
    res.status(500).json({ error: 'Failed to solve problem. Please try again.' })
  }
})

const MAX_STUDY_PACKS = 30

// DELETE /api/ai/study-packs/:packId — delete a single study pack
router.delete('/study-packs/:packId', requireAuth, requireSubscription, requirePremium, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('study_packs')
      .delete()
      .eq('id', req.params.packId)
      .eq('user_id', req.user.id) // ensure ownership
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    console.error('Delete study pack error:', err)
    res.status(500).json({ error: 'Failed to delete study pack.' })
  }
})

// POST /api/ai/study-pack — generate full study pack
router.post('/study-pack', requirePremium, async (req, res) => {
  const { topic, content, subject } = req.body
  if (!topic && !content) return res.status(400).json({ error: 'Topic or content is required.' })
  try {
    // ── Enforce 30-pack limit ─────────────────────────────────────
    const { count } = await supabaseAdmin
      .from('study_packs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    if (count >= MAX_STUDY_PACKS) {
      return res.status(400).json({
        error: `You have reached the maximum of ${MAX_STUDY_PACKS} study packs. Delete older packs to create new ones.`,
        code:  'PACK_LIMIT_REACHED',
      })
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('course').eq('id', req.user.id).single()
    const course = subject || profile?.course
    let result

    if (content) {
      // Document upload path — summarise then wrap as study pack
      const summary = await summariseDocument({ documentText: content, title: topic, course })

      // ── Gleaning: save this summary to user's personal context store ──
      // Future AI calls for this user will be enriched with their own material
      saveUserDocument({
        userId:     req.user.id,
        title:      topic || 'Uploaded document',
        subject:    course,
        summary:    summary.text,
        sourceType: 'study_pack',
      }) // Fire-and-forget — non-blocking

      result = {
        content: { title: topic || 'Study Pack', summary: summary.text, keyPoints: [], flashcards: [], quiz: [] },
        fromCache: false,
      }
    } else {
      result = await generateStudyPack({ topic, course })
    }

    const { data: pack } = await supabaseAdmin.from('study_packs').insert({
      user_id:     req.user.id,
      title:       result.content.title || topic,
      topic:       topic || null,
      content:     result.content,
      source_type: content ? 'document' : 'topic',
    }).select().single()

    res.json({ pack, fromCache: result.fromCache })
  } catch (err) {
    console.error('Study pack error:', err)
    res.status(500).json({ error: 'Failed to generate study pack.' })
  }
})

// POST /api/ai/summarise — summarise uploaded document
// Also saves the summary to user_documents for future AI context enrichment.
router.post('/summarise', requirePremium, async (req, res) => {
  const { content, title } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' })
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('course').eq('id', req.user.id).single()
    const result = await summariseDocument({ documentText: content, title, course: profile?.course })

    // ── Gleaning: save this summary to user's personal context store ──
    saveUserDocument({
      userId:     req.user.id,
      title:      title || 'Uploaded document',
      subject:    profile?.course,
      summary:    result.text,
      sourceType: 'upload',
    }) // Fire-and-forget — non-blocking

    res.json({ summary: result.text, tokenCount: result.tokenCount })
  } catch (err) {
    console.error('Summarise error:', err)
    res.status(500).json({ error: 'Failed to summarise. Please try again.' })
  }
})

// POST /api/ai/refine — refine a previous answer
router.post('/refine', requirePremium, async (req, res) => {
  const { originalAnswer, refinementRequest, context } = req.body
  if (!originalAnswer || !refinementRequest) return res.status(400).json({ error: 'Original answer and refinement request are required.' })
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('course, university').eq('id', req.user.id).single()
    const result = await generateAnswer({
      question:   `Original answer:\n${originalAnswer}\n\nStudent's request: "${refinementRequest}"${context ? `\nContext: ${context}` : ''}`,
      course:     profile?.course,
      university: profile?.university,
      userId:     req.user.id,
    })
    res.json({ response: result.text })
  } catch (err) {
    console.error('Refine error:', err)
    res.status(500).json({ error: 'Failed to refine answer. Please try again.' })
  }
})

// POST /api/ai/flag — flag an inaccurate answer
router.post('/flag', async (req, res) => {
  const { question, answer, reason } = req.body
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required.' })
  try {
    await supabaseAdmin.from('flagged_answers').insert({ user_id: req.user.id, question, answer, reason: reason || 'Flagged as inaccurate' })
    res.json({ success: true, message: 'Thank you — our team will review this.' })
  } catch (err) {
    console.error('Flag error:', err)
    res.status(500).json({ error: 'Failed to submit flag.' })
  }
})

// POST /api/ai/save-to-library — save any content offline
router.post('/save-to-library', async (req, res) => {
  const { itemType, title, content } = req.body
  if (!itemType || !title || !content) return res.status(400).json({ error: 'Item type, title, and content required.' })
  try {
    const { data, error } = await supabaseAdmin.from('library_items').insert({
      user_id:   req.user.id,
      item_type: itemType,
      title,
      content:   typeof content === 'string' ? { text: content } : content,
    }).select().single()
    if (error) throw error
    res.json({ success: true, item: data })
  } catch (err) {
    console.error('Save to library error:', err)
    res.status(500).json({ error: 'Failed to save to library.' })
  }
})

// GET /api/ai/library — get all saved library items
router.get('/library', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('library_items').select('*').eq('user_id', req.user.id)
      .order('saved_at', { ascending: false })
      .limit(100)
    if (error) throw error
    res.json({ items: data || [] })
  } catch (err) {
    console.error('Library error:', err)
    res.status(500).json({ error: 'Failed to load library.' })
  }
})

// POST /api/ai/ask/stream — streaming endpoint
router.post('/ask/stream', requirePremium, async (req, res) => {
  const { question, followUp } = req.body
  if (!question?.trim()) return res.status(400).json({ error: 'Question is required.' })
  const { data: profile } = await supabaseAdmin.from('profiles').select('course, university').eq('id', req.user.id).single()
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  try {
    const isMath = /\d+.*[\+\-\*\/\=\^]|solve|calculate|find\s+x|derivative|integral|equation/i.test(question)
    const model  = isMath ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
    const systemPrompt = isMath
      ? `You are Padi, expert maths tutor. Show every step numbered. Mark final answer clearly. End with: "⚠️ Cross-check for high-stakes calculations."`
      : `You are Padi, expert AI study partner for university students. Answer clearly with examples and 1-2 citations. End with: "⚠️ Always verify with your lecturer or course material." Student studying ${profile?.course || 'their course'}.`
    await streamAnthropic({ systemPrompt, userMessage: followUp ? `Original: ${question}\nFollow-up: ${followUp}` : question, model, maxTokens: 1200, onChunk: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`) })
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Stream error:', err)
    res.write(`data: ${JSON.stringify({ error: 'Stream failed.' })}\n\n`)
    res.end()
  }
})

export default router
