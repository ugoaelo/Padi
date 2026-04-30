import crypto from 'crypto'
import { supabaseAdmin } from '../db/supabase.js'
import { getUserDocumentContext, getKnowledgeBaseContext } from './userContext.js'
import 'dotenv/config'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'

const MODELS = {
  fast:  'claude-haiku-4-5-20251001',
  smart: 'claude-sonnet-4-6',
}

const SMART_TASKS = ['exam_simulation', 'past_question_analysis', 'math_solution', 'detailed_explanation']
function selectModel(task) { return SMART_TASKS.includes(task) ? MODELS.smart : MODELS.fast }

function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(prompt.trim().toLowerCase()).digest('hex')
}

async function getCachedResponse(hash) {
  try {
    const { data } = await supabaseAdmin.from('ai_cache').select('response').eq('prompt_hash', hash).single()
    return data?.response || null
  } catch { return null }
}

async function setCachedResponse(hash, response, model, tokenCount) {
  try {
    await supabaseAdmin.from('ai_cache').insert({ prompt_hash: hash, response, model_used: model, token_count: tokenCount })
  } catch (err) { console.warn('Cache write failed:', err.message) }
}

// ── Timeout wrapper — prevents hung AI calls from blocking the server ─
export async function withTimeout(promise, ms = 9000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI request timed out. Please try again.')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export async function callAnthropic({ systemPrompt, userMessage, model, maxTokens = 1000 }) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
  })
  if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || 'Anthropic API failed') }
  const data = await response.json()
  return { text: data.content[0].text, tokenCount: data.usage.input_tokens + data.usage.output_tokens, model }
}

// ── Generic callAI wrapper (used by exam, spaced, admin services) ─
export async function callAI({ systemPrompt, userPrompt, taskType = 'general', useCache = true, maxTokens = 1000 }) {
  const model    = selectModel(taskType)
  const cacheKey = hashPrompt(`${taskType}:${systemPrompt}:${userPrompt}`)

  if (useCache) {
    const cached = await getCachedResponse(cacheKey)
    if (cached) return { response: cached, fromCache: true, tokensUsed: 0 }
  }

  const result = await withTimeout(callAnthropic({ systemPrompt, userMessage: userPrompt, model, maxTokens }))

  if (useCache) await setCachedResponse(cacheKey, result.text, model, result.tokenCount)

  return { response: result.text, fromCache: false, tokensUsed: result.tokenCount, model }
}

// ── Streaming ─────────────────────────────────────────────────────
export async function streamAnthropic({ systemPrompt, userMessage, model, maxTokens = 1000, onChunk }) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
  })
  if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || 'Stream failed') }
  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText  = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(6))
        if (json.type === 'content_block_delta' && json.delta?.text) { fullText += json.delta.text; onChunk(json.delta.text) }
      } catch { /* skip malformed chunks */ }
    }
  }
  return fullText
}

// ── generateAnswer ────────────────────────────────────────────────
// userId is optional — when provided, injects the student's uploaded
// document summaries for personalised, course-specific answers.
// Knowledge base context (admin-uploaded) is always injected when available.
// Privacy rule: responses are NOT cached when user-specific context is injected.
export async function generateAnswer({ question, course, university, userId, followUp = null }) {
  // Fixed cache key: now includes university (was missing before)
  const cacheKey = hashPrompt(`answer:${question}:${course}:${university}`)
  const cached   = await getCachedResponse(cacheKey)
  if (cached) return { text: cached, fromCache: true }

  // Fetch knowledge base and user document context in parallel
  const [kbContext, userDocContext] = await Promise.all([
    getKnowledgeBaseContext(course),
    getUserDocumentContext(userId, course),
  ])

  const hasUserContext = !!userDocContext
  const contextBlock = [
    kbContext    ? `\n\nRELEVANT EDUCATIONAL RESOURCES:\n${kbContext}` : '',
    userDocContext ? `\n\nSTUDENT\'S UPLOADED COURSE NOTES:\n${userDocContext}` : '',
  ].join('')

  const model        = selectModel('answer')
  const systemPrompt = `You are Padi, an expert AI study partner for university students in Africa.
Your answers must be clear, accurate, university-level, structured (explanation → examples → summary), include 1-3 citations, show step-by-step working for calculations, and end with: "⚠️ Always verify critical information with your lecturer or official course material."
Student is studying ${course || 'their course'} at ${university || 'university'}.${contextBlock}`

  const result = await withTimeout(callAnthropic({
    systemPrompt,
    userMessage: followUp ? `Original: ${question}\nFollow-up: ${followUp}` : question,
    model, maxTokens: 1200,
  }))

  // Only cache when no user-specific context — preserves privacy and cache consistency
  if (!hasUserContext) {
    await setCachedResponse(cacheKey, result.text, model, result.tokenCount)
  }

  return { text: result.text, fromCache: false, tokenCount: result.tokenCount }
}

// ── solveMath ─────────────────────────────────────────────────────
export async function solveMath({ problem, course }) {
  const model        = selectModel('math_solution')
  const systemPrompt = `You are Padi, an expert maths tutor. Show every step numbered with plain language explanations. Mark the final answer clearly. End with: "⚠️ Cross-check this working for high-stakes calculations."`
  const result       = await withTimeout(callAnthropic({ systemPrompt, userMessage: `Solve step by step: ${problem}`, model, maxTokens: 1500 }))
  return { text: result.text, tokenCount: result.tokenCount }
}

// ── summariseDocument ─────────────────────────────────────────────
export async function summariseDocument({ documentText, title, course }) {
  const truncated    = documentText.slice(0, 8000)
  const model        = selectModel('summary')
  const systemPrompt = `You are Padi. Summarise study material for a university student. Structure: 1) What this covers 2) Key Concepts 3) Definitions 4) Exam-Relevant Points 5) 3-5 practice questions. Student studying ${course || 'their course'}.`
  const result       = await withTimeout(callAnthropic({ systemPrompt, userMessage: `Title: ${title || 'Uploaded document'}\n\n${truncated}`, model, maxTokens: 1500 }))
  return { text: result.text, tokenCount: result.tokenCount }
}

// ── generateStudyPack ─────────────────────────────────────────────
// Injects knowledge base context so packs are grounded in curated content.
export async function generateStudyPack({ topic, course, level = 'university' }) {
  const cacheKey = hashPrompt(`studypack:${topic}:${course}`)
  const cached   = await getCachedResponse(cacheKey)
  if (cached) return { content: JSON.parse(cached), fromCache: true }

  // Enrich with knowledge base context for this subject
  const kbContext = await getKnowledgeBaseContext(course)
  const contextNote = kbContext ? `\n\nRelevant curated resources for context:\n${kbContext}` : ''

  const model  = selectModel('study_pack')
  const result = await withTimeout(callAnthropic({
    systemPrompt: `You are Padi. Return ONLY valid JSON, no markdown or explanation.${contextNote}`,
    userMessage:  `Study pack for: "${topic}" (${course}, ${level})\nReturn ONLY: {"title":"","summary":"","keyPoints":[],"notes":"","flashcards":[{"front":"","back":""}],"quiz":[{"question":"","options":["","","",""],"answer":"","explanation":""}],"examTips":[],"citation":""}`,
    model, maxTokens: 2000,
  }))

  let content
  try { content = JSON.parse(result.text.replace(/```json|```/g, '').trim()) }
  catch { content = { title: topic, summary: result.text, keyPoints: [], flashcards: [], quiz: [] } }
  await setCachedResponse(cacheKey, JSON.stringify(content), model, result.tokenCount)
  return { content, fromCache: false, tokenCount: result.tokenCount }
}

// ── generateRecallQuestions ───────────────────────────────────────
export async function generateRecallQuestions({ topic, content }) {
  const model  = selectModel('recall')
  const result = await withTimeout(callAnthropic({
    systemPrompt: `You are Padi. Return ONLY valid JSON.`,
    userMessage:  `6 active recall questions for: "${topic}"\nContent: ${content?.slice(0, 2000) || topic}\nReturn: {"questions":[{"type":"concept|fill_blank|short_answer","question":"","answer":""}]}`,
    model, maxTokens: 800,
  }))
  try { return JSON.parse(result.text.replace(/```json|```/g, '').trim()) }
  catch { return { questions: [] } }
}
