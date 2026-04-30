import { Router } from 'express'
import { requireAuth, requireSubscription, requirePremium } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import {
  generateExamQuestions,
  gradeShortAnswer,
  analysePastQuestions,
  generatePredictedQuestions,
} from '../services/exam.js'

const router = Router()
router.use(requireAuth, requireSubscription, requirePremium, aiLimiter)

// ── POST /api/exam/generate ───────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { topic, content, subject, count = 10, difficulty = 'medium' } = req.body
    if (!topic && !content) return res.status(400).json({ error: 'Topic or content is required.' })

    const result = await generateExamQuestions({ topic, content, subject, count, difficulty })

    if (!result.data) return res.status(500).json({ error: 'Failed to generate exam questions.' })

    // Save session to DB
    const { data: session } = await supabaseAdmin
      .from('exam_sessions')
      .insert({
        user_id:   req.user.id,
        topic:     topic || 'Custom content',
        questions: result.data.questions,
        answers:   [],
        score:     0,
        total:     result.data.questions.length,
        // completed_at intentionally omitted — stays NULL until /submit
      })
      .select()
      .single()

    res.json({ ...result, sessionId: session?.id })
  } catch (err) {
    console.error('Exam generate error:', err)
    res.status(500).json({ error: 'Failed to generate exam.' })
  }
})

// ── POST /api/exam/submit ─────────────────────────────────────────
// Short-answer grading runs in PARALLEL — eliminates the sequential
// latency bottleneck (5 short-answer questions used to take 10s+; now ~2s).
router.post('/submit', async (req, res) => {
  try {
    const { sessionId, answers, timeTaken, questions } = req.body
    if (!sessionId || !answers) return res.status(400).json({ error: 'Session ID and answers required.' })

    // ── Separate MCQ (no AI) from short_answer (AI grading) ──────
    const mcqQuestions          = questions.filter(q => q.type === 'mcq')
    const shortAnswerQuestions  = questions.filter(q => q.type === 'short_answer' && answers[q.id]?.trim())
    const unansweredShortAnswer = questions.filter(q => q.type === 'short_answer' && !answers[q.id]?.trim())

    // ── Grade MCQs synchronously (no AI needed) ──────────────────
    const mcqGraded = mcqQuestions.map(q => {
      const studentAnswer = answers[q.id]
      const correct       = studentAnswer === q.correct
      const score         = correct ? (q.marks || 1) : 0
      return {
        questionId:   q.id, studentAnswer, correct: q.correct,
        isCorrect:    correct, score, maxScore: q.marks || 1,
        explanation:  q.explanation,
      }
    })

    // ── Grade short answers in PARALLEL ─────────────────────────
    const shortAnswerGraded = await Promise.all(
      shortAnswerQuestions.map(async q => {
        const grading = await gradeShortAnswer({
          question:      q.question,
          sampleAnswer:  q.sampleAnswer,
          studentAnswer: answers[q.id],
          keywords:      q.keywords,
          marks:         q.marks || 3,
        })
        return {
          questionId:      q.id, studentAnswer: answers[q.id],
          score:           grading.score, maxScore: grading.maxScore,
          feedback:        grading.feedback,
          keywordsFound:   grading.keywordsFound,
          keywordsMissed:  grading.keywordsMissed,
        }
      })
    )

    // ── Zero score for unanswered short-answer questions ─────────
    const unansweredGraded = unansweredShortAnswer.map(q => ({
      questionId: q.id, studentAnswer: '', score: 0, maxScore: q.marks || 3,
      feedback: 'Not answered.', keywordsFound: [], keywordsMissed: q.keywords || [],
    }))

    const gradedAnswers = [...mcqGraded, ...shortAnswerGraded, ...unansweredGraded]

    // ── Calculate totals ─────────────────────────────────────────
    const totalScore = gradedAnswers.reduce((sum, a) => sum + a.score, 0)
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0)
    const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0

    // ── Update session in DB ──────────────────────────────────────
    await supabaseAdmin
      .from('exam_sessions')
      .update({
        answers:      gradedAnswers,
        score:        totalScore,
        total:        totalMarks,
        time_taken:   timeTaken,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', req.user.id)

    // ── Identify weak areas ───────────────────────────────────────
    const weakTopics = gradedAnswers
      .filter(a => (a.score / a.maxScore) < 0.5)
      .map(a => questions.find(q => q.id === a.questionId)?.question?.substring(0, 60))
      .filter(Boolean)

    res.json({ score: totalScore, total: totalMarks, percentage, gradedAnswers, weakTopics, passed: percentage >= 50 })
  } catch (err) {
    console.error('Exam submit error:', err)
    res.status(500).json({ error: 'Failed to submit exam.' })
  }
})

// ── PATCH /api/exam/:sessionId/progress ──────────────────────────
// Save mid-exam progress (question index + time remaining).
// Called every N questions or on page unload — does NOT grade or complete the session.
router.patch('/:sessionId/progress', async (req, res) => {
  try {
    const { questionIndex, timeRemaining, answers } = req.body
    await supabaseAdmin
      .from('exam_sessions')
      .update({
        question_index: questionIndex ?? 0,
        time_remaining: timeRemaining  ?? null,
        answers:        answers        ?? [],
      })
      .eq('id',      req.params.sessionId)
      .eq('user_id', req.user.id)
      .is('completed_at', null)  // only update incomplete sessions
    res.json({ saved: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save progress.' })
  }
})

// ── GET /api/exam/incomplete ──────────────────────────────────────
// Returns the most recent incomplete session for the current user, if any.
// Used to surface the "Resume exam" card on the Exam page.
router.get('/incomplete', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, topic, total, question_index, time_remaining, questions, answers, created_at')
      .eq('user_id', req.user.id)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    res.json({ session: data || null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to check for incomplete session.' })
  }
})

// ── GET /api/exam/history ─────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('exam_sessions')
      .select('id, topic, score, total, time_taken, completed_at')
      .eq('user_id', req.user.id)
      .not('completed_at', 'is', null)  // Only show completed sessions
      .order('completed_at', { ascending: false })
      .limit(20)
    res.json({ sessions: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load exam history.' })
  }
})

// ── POST /api/exam/past-questions/analyse ─────────────────────────
router.post('/past-questions/analyse', async (req, res) => {
  try {
    const { content, subject } = req.body
    if (!content?.trim()) return res.status(400).json({ error: 'Past question content is required.' })
    const result = await analysePastQuestions({ content, subject })
    if (!result.data) return res.status(500).json({ error: 'Failed to analyse past questions.' })
    res.json(result)
  } catch (err) {
    console.error('Past question analyse error:', err)
    res.status(500).json({ error: 'Failed to analyse past questions.' })
  }
})

// ── POST /api/exam/past-questions/predict ─────────────────────────
router.post('/past-questions/predict', async (req, res) => {
  try {
    const { predictedTopics, subject, count } = req.body
    if (!predictedTopics?.length) return res.status(400).json({ error: 'Predicted topics required.' })
    const result = await generatePredictedQuestions({ predictedTopics, subject, count })
    if (!result.data) return res.status(500).json({ error: 'Failed to generate predicted questions.' })
    res.json(result)
  } catch (err) {
    console.error('Predict questions error:', err)
    res.status(500).json({ error: 'Failed to generate predicted questions.' })
  }
})

export default router
