import { callAI } from './ai.js'

// ── Generate exam questions from topic or content ─────────────────
export async function generateExamQuestions({ topic, content, subject, count = 10, difficulty = 'medium' }) {
  const systemPrompt = `You are Padi, an expert exam question generator for university students.

Generate realistic exam-style questions. Respond ONLY with valid JSON. No markdown, no backticks, no preamble.

JSON structure:
{
  "title": "string",
  "subject": "string",
  "difficulty": "easy|medium|hard",
  "timeLimit": number (minutes — suggest based on question count),
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "question": "string",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct": "A",
      "explanation": "string",
      "marks": 1
    },
    {
      "id": "q2", 
      "type": "short_answer",
      "question": "string",
      "sampleAnswer": "string",
      "marks": 3,
      "keywords": ["key1", "key2"]
    }
  ]
}`

  const userPrompt = content
    ? `Generate ${count} exam questions (mix of MCQ and short answer) at ${difficulty} difficulty from this content:\n\n${content.substring(0, 3000)}`
    : `Generate ${count} exam questions (mix of MCQ and short answer) at ${difficulty} difficulty for: "${topic}"${subject ? ` (${subject})` : ''}`

  const result = await callAI({
    systemPrompt,
    userPrompt,
    taskType:  'exam_simulation',
    useCache:  false, // always fresh questions
    maxTokens: 2500,
  })

  try {
    const parsed = JSON.parse(result.response.replace(/```json|```/g, '').trim())
    return { ...result, data: parsed }
  } catch {
    return { ...result, data: null, parseError: true }
  }
}

// ── Grade a short answer question ─────────────────────────────────
export async function gradeShortAnswer({ question, sampleAnswer, studentAnswer, keywords, marks }) {
  const systemPrompt = `You are a university examiner. Grade this student answer fairly and precisely.

Respond ONLY with valid JSON:
{
  "score": number (0 to ${marks}),
  "maxScore": ${marks},
  "feedback": "string (constructive, specific)",
  "keywordsFound": ["string"],
  "keywordsMissed": ["string"]
}`

  const userPrompt = `Question: ${question}

Sample/Model answer: ${sampleAnswer}

Keywords to look for: ${keywords?.join(', ')}

Student's answer: ${studentAnswer}

Award marks out of ${marks} based on accuracy, completeness and relevant keywords used.`

  const result = await callAI({
    systemPrompt,
    userPrompt,
    taskType:  'exam_simulation',
    useCache:  false,
    maxTokens: 400,
  })

  try {
    const parsed = JSON.parse(result.response.replace(/```json|```/g, '').trim())
    return parsed
  } catch {
    return { score: 0, maxScore: marks, feedback: 'Unable to grade automatically. Please review manually.', keywordsFound: [], keywordsMissed: [] }
  }
}

// ── Analyse past questions ────────────────────────────────────────
export async function analysePastQuestions({ content, subject }) {
  const systemPrompt = `You are Padi, an expert exam analyst. Analyse past exam questions to identify patterns.

Respond ONLY with valid JSON. No markdown, no backticks, no preamble.

JSON structure:
{
  "totalQuestions": number,
  "topicFrequency": [
    {"topic": "string", "count": number, "percentage": number, "likelihood": "Very High|High|Medium|Low"}
  ],
  "questionTypes": [{"type": "string", "count": number}],
  "predictedTopics": [
    {"topic": "string", "reasoning": "string", "likelihood": "Very High|High|Medium|Low", "suggestedStudyTime": "string"}
  ],
  "examPatterns": ["string"],
  "studyRecommendations": ["string"]
}`

  const userPrompt = `Analyse these past exam questions${subject ? ` for ${subject}` : ''} and identify patterns, frequently tested topics, and predictions for future exams:\n\n${content.substring(0, 4000)}`

  const result = await callAI({
    systemPrompt,
    userPrompt,
    taskType:  'past_question_analysis',
    useCache:  true,
    maxTokens: 1500,
  })

  try {
    const parsed = JSON.parse(result.response.replace(/```json|```/g, '').trim())
    return { ...result, data: parsed }
  } catch {
    return { ...result, data: null, parseError: true }
  }
}

// ── Generate predicted exam questions ────────────────────────────
export async function generatePredictedQuestions({ predictedTopics, subject, count = 5 }) {
  const topicList = predictedTopics.map(t => t.topic).join(', ')

  const systemPrompt = `You are Padi, an expert exam question generator. Generate predicted exam questions based on topic analysis.

Respond ONLY with valid JSON:
{
  "questions": [
    {
      "id": "string",
      "topic": "string",
      "type": "mcq|short_answer|essay",
      "question": "string",
      "options": ["A...","B...","C...","D..."] or null,
      "correct": "A" or null,
      "sampleAnswer": "string",
      "marks": number,
      "likelihood": "Very High|High|Medium"
    }
  ]
}`

  const userPrompt = `Generate ${count} predicted exam questions for these high-probability topics${subject ? ` in ${subject}` : ''}: ${topicList}

Focus on the highest likelihood topics. Mix question types.`

  const result = await callAI({
    systemPrompt,
    userPrompt,
    taskType:  'past_question_prediction',
    useCache:  true,
    maxTokens: 2000,
  })

  try {
    const parsed = JSON.parse(result.response.replace(/```json|```/g, '').trim())
    return { ...result, data: parsed }
  } catch {
    return { ...result, data: null, parseError: true }
  }
}
