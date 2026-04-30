/**
 * Content service — TQ parsing, solution generation, admin upload pipeline
 */

import { callAnthropic, withTimeout } from './ai.js'
import { supabaseAdmin }              from '../db/supabase.js'

// ── SOLUTION GENERATION ───────────────────────────────────────────────────────

/**
 * Generate an AI solution for a tutorial question.
 * Subject-specific system prompt modifiers applied per discipline.
 */
export async function solveTutorialQuestion({
  questionText,
  courseCode,
  courseTitle,
  level,
  topic,
  context,
  userId,
}) {
  const discipline = getDiscipline(courseCode)
  const systemPrompt = buildSystemPrompt(discipline, courseCode, courseTitle, level)

  const userPrompt = [
    `Course: ${courseCode} — ${courseTitle} (${level}L)`,
    topic ? `Topic: ${topic}` : null,
    context ? `Additional context from student: ${context}` : null,
    '',
    'Question:',
    questionText,
  ].filter(Boolean).join('\n')

  return withTimeout(
    callAnthropic({
      systemPrompt,
      userPrompt,
      model:    selectModel(discipline),
      maxTokens: 1500,
    }),
    9000
  )
}

function getDiscipline(courseCode) {
  const prefix = courseCode?.split(' ')[0]?.toUpperCase() || ''
  if (['SEN','CSC','COS','CIS','SEG','CYB','CYS'].includes(prefix)) return 'computing'
  if (['PHY','CHM','BIO','MCB','BCH'].includes(prefix))               return 'science'
  if (['MTH','STA','MAT'].includes(prefix))                           return 'mathematics'
  if (['ENG','LIT','GST','GNS'].includes(prefix))                     return 'general'
  return 'general'
}

function selectModel(discipline) {
  // Use Sonnet for maths (full derivation needed), Haiku for everything else
  return discipline === 'mathematics'
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001'
}

function buildSystemPrompt(discipline, courseCode, courseTitle, level) {
  const base = `You are Padi, an AI study partner helping Nigerian university students understand their tutorial questions. You give clear, accurate, exam-focused explanations. Always structure your solutions logically. Use LaTeX notation (wrapped in $ for inline, $$ for block) for all mathematical expressions and equations — this renders correctly in the app.`

  const modifiers = {
    computing: `
For computing questions:
- Show pseudocode where relevant, then explain in plain English
- For algorithms: state time/space complexity
- For theory: give the definition, then apply it to the question
- Be concise but complete — cover all marks`,

    mathematics: `
For mathematics questions:
- State all formulae used before applying them
- Show full step-by-step derivation — no skipped steps
- Define all variables clearly
- Box the final answer
- If multiple methods exist, show the most exam-appropriate one`,

    science: `
For science questions:
- State relevant laws/principles first
- Show formulae with units
- Show full working — examiners award method marks
- Give units in every step`,

    general: `
- Be clear and direct
- Structure your answer with numbered points where appropriate
- Cover all aspects of the question`,
  }

  return base + (modifiers[discipline] || modifiers.general)
}

// ── COURSE UTILITIES ──────────────────────────────────────────────────────────

/**
 * Infer the academic level from a course code number.
 * e.g. CMP 201 → 200, PHY 112 → 100, ENG 301 → 300
 * Works by taking the first digit of the numeric part of the code.
 */
export function inferLevelFromCourseCode(courseCode) {
  const match = courseCode?.match(/(\d+)/)
  if (!match) return null
  const firstDigit = Math.floor(parseInt(match[1]) / 100)
  if (firstDigit >= 1 && firstDigit <= 9) return firstDigit * 100
  return null
}

// ── TQ PARSING (admin upload pipeline) ────────────────────────────────────────

/**
 * Parse raw uploaded content (text extracted from doc/pdf/image) into
 * structured tutorial questions ready for admin preview + edit.
 *
 * Returns: Array of { question_number, question_text, topic }
 */
export async function parseTutorialQuestions({ rawContent, courseCode, courseTitle }) {
  const systemPrompt = `You are a content parser for an educational platform. Extract tutorial questions from raw text content. Return a JSON array of objects. Each object must have:
- "question_number": integer (sequential, starting at 1)
- "question_text": the full question text, cleaned of formatting artifacts
- "topic": your best guess at the topic/subtopic this question covers (brief, 3-5 words)

Rules:
- Preserve ALL parts of multi-part questions (a, b, c) as one question_text entry
- Remove headers, footers, page numbers, watermarks
- Fix obvious OCR errors (e.g. "l" mistaken for "1", "0" for "O")
- If a question is clearly incomplete or garbled beyond repair, include it anyway with a note in question_text: "[Note: may need review]"
- Return ONLY the JSON array, no other text`

  const userPrompt = `Course: ${courseCode} — ${courseTitle}

Raw content to parse:
${rawContent}`

  const response = await withTimeout(
    callAnthropic({
      systemPrompt,
      userPrompt,
      model:     'claude-sonnet-4-6',  // Sonnet for parsing accuracy
      maxTokens: 4000,
    }),
    15000
  )

  try {
    // Strip markdown code fences if present
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch (err) {
    console.error('TQ parse JSON error:', err)
    throw new Error('Failed to parse questions from content. Please review the raw text.')
  }
}

/**
 * Save parsed questions to DB as drafts for admin preview.
 * Returns the inserted question IDs.
 */
export async function saveDraftQuestions({ questions, courseId, schoolId, uploadedBy }) {
  const rows = questions.map((q, i) => ({
    school_id:       schoolId,
    course_id:       courseId,
    question_text:   q.question_text,
    topic:           q.topic || null,
    question_number: q.question_number || i + 1,
    status:          'draft',
    uploaded_by:     uploadedBy,
  }))

  const { data, error } = await supabaseAdmin
    .from('tutorial_questions')
    .insert(rows)
    .select('id, question_number, question_text, topic, status')

  if (error) throw error
  return data
}

/**
 * Publish a batch of draft questions (admin confirms after preview + edit).
 */
export async function publishQuestions(questionIds) {
  const { error } = await supabaseAdmin
    .from('tutorial_questions')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .in('id', questionIds)
    .eq('status', 'draft')

  if (error) throw error
  return { published: questionIds.length }
}

/**
 * Update a single question (admin edits typos in preview).
 */
export async function updateQuestion(questionId, updates) {
  const allowed = ['question_text', 'topic', 'question_number']
  const safe    = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const { data, error } = await supabaseAdmin
    .from('tutorial_questions')
    .update(safe)
    .eq('id', questionId)
    .eq('status', 'draft')  // can only edit drafts
    .select()
    .single()

  if (error) throw error
  return data
}
