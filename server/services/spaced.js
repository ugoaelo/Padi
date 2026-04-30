import { supabaseAdmin } from '../db/supabase.js'
import { callAI } from './ai.js'

function sm2(quality, repetitions, easeFactor, interval) {
  if (quality < 3) return { repetitions: 0, interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2) }
  let newInterval
  if (repetitions === 0)      newInterval = 1
  else if (repetitions === 1) newInterval = 6
  else                        newInterval = Math.round(interval * easeFactor)
  const newEaseFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  return { repetitions: repetitions + 1, interval: newInterval, easeFactor: newEaseFactor }
}

export async function getReviewItems(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabaseAdmin
    .from('review_items')
    .select('*')
    .eq('user_id', userId)
    .lte('next_review', today)
    .order('next_review', { ascending: true })
    .limit(20)
  return data || []
}

export async function updateReviewItem(itemId, userId, quality) {
  const { data: item } = await supabaseAdmin
    .from('review_items').select('repetitions,ease_factor,interval')
    .eq('id', itemId).eq('user_id', userId).single()
  if (!item) throw new Error('Review item not found')
  const { repetitions, interval, easeFactor } = sm2(quality, item.repetitions||0, item.ease_factor||2.5, item.interval||1)
  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)
  const { data } = await supabaseAdmin
    .from('review_items')
    .update({ repetitions, interval, ease_factor: easeFactor, next_review: nextReview.toISOString().split('T')[0], last_reviewed: new Date().toISOString() })
    .eq('id', itemId).select().single()
  return data
}

export async function scheduleStudyPackForReview(userId, packId, packContent) {
  const items = []

  // ── Flashcards (front/back) ────────────────────────────────────
  // Study pack JSON uses "flashcards" with {front, back} structure
  if (packContent.flashcards?.length) {
    for (const card of packContent.flashcards.slice(0, 15)) {
      if (!card.front || !card.back) continue
      items.push({
        user_id: userId, pack_id: packId, item_type: 'flashcard',
        front: card.front, back: card.back,
        next_review: new Date().toISOString().split('T')[0],
        repetitions: 0, ease_factor: 2.5, interval: 1,
      })
    }
  }

  // ── Key points as concept cards ───────────────────────────────
  // Study pack JSON uses "keyPoints" — an array of strings.
  // Convert each key point into a simple recall card.
  if (packContent.keyPoints?.length) {
    for (const point of packContent.keyPoints.slice(0, 10)) {
      if (!point || typeof point !== 'string') continue
      items.push({
        user_id: userId, pack_id: packId, item_type: 'concept',
        front: `What do you know about: "${point.substring(0, 120)}"?`,
        back: point,
        next_review: new Date().toISOString().split('T')[0],
        repetitions: 0, ease_factor: 2.5, interval: 1,
      })
    }
  }

  if (items.length === 0) return []
  const { data, error } = await supabaseAdmin.from('review_items').insert(items).select()
  if (error) throw error
  return data
}

export async function generateRecallQuestions({ topic, packContent, count = 5 }) {
  const systemPrompt = `You are Padi. Generate active recall questions. Respond ONLY with valid JSON:
{"questions":[{"type":"fill_blank|concept_recall|problem_solving|short_answer","question":"string","hint":"string","answer":"string"}]}`
  const content = packContent
    ? `Key points: ${packContent.keyPoints?.join(', ')}\nSummary: ${packContent.summary}`
    : `Topic: ${topic}`
  const userPrompt = `Generate ${count} active recall questions for: ${content}. Mix fill_blank, concept_recall, problem_solving, short_answer types.`
  const result = await callAI({ systemPrompt, userPrompt, taskType: 'study_pack', useCache: false, maxTokens: 1000 })
  try {
    const parsed = JSON.parse(result.response.replace(/```json|```/g,'').trim())
    return { ...result, data: parsed }
  } catch { return { ...result, data: null, parseError: true } }
}

export async function getReviewStats(userId) {
  const today = new Date().toISOString().split('T')[0]
  const [dueResult, totalResult] = await Promise.all([
    supabaseAdmin.from('review_items').select('*',{count:'exact',head:true}).eq('user_id',userId).lte('next_review',today),
    supabaseAdmin.from('review_items').select('*',{count:'exact',head:true}).eq('user_id',userId),
  ])
  return { due: dueResult.count||0, total: totalResult.count||0 }
}
