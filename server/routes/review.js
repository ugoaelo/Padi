import { Router } from 'express'
import { requireAuth, requireSubscription, requirePremium } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimiter.js'
import {
  getReviewItems,
  updateReviewItem,
  scheduleStudyPackForReview,
  generateRecallQuestions,
  getReviewStats,
} from '../services/spaced.js'

const router = Router()
router.use(requireAuth, requireSubscription, requirePremium)

// GET /api/review/items — get items due for review today
router.get('/items', async (req, res) => {
  try {
    const items = await getReviewItems(req.user.id)
    res.json({ items })
  } catch (err) {
    console.error('Get review items error:', err)
    res.status(500).json({ error: 'Failed to load review items.' })
  }
})

// GET /api/review/stats — get review counts
router.get('/stats', async (req, res) => {
  try {
    const stats = await getReviewStats(req.user.id)
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load review stats.' })
  }
})

// POST /api/review/answer — submit answer quality for SM-2
router.post('/answer', async (req, res) => {
  try {
    const { itemId, quality } = req.body
    if (!itemId || quality === undefined) {
      return res.status(400).json({ error: 'Item ID and quality required.' })
    }
    if (quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Quality must be 0-5.' })
    }
    const updated = await updateReviewItem(itemId, req.user.id, quality)
    res.json({ item: updated })
  } catch (err) {
    console.error('Review answer error:', err)
    res.status(500).json({ error: 'Failed to update review.' })
  }
})

// POST /api/review/schedule — add study pack items to review queue
router.post('/schedule', async (req, res) => {
  try {
    const { packId, packContent } = req.body
    if (!packId || !packContent) {
      return res.status(400).json({ error: 'Pack ID and content required.' })
    }
    const items = await scheduleStudyPackForReview(req.user.id, packId, packContent)
    res.json({ items, count: items.length })
  } catch (err) {
    console.error('Schedule review error:', err)
    res.status(500).json({ error: 'Failed to schedule review.' })
  }
})

// POST /api/review/recall — generate active recall questions
router.post('/recall', aiLimiter, async (req, res) => {
  try {
    const { topic, packContent, count } = req.body
    if (!topic && !packContent) {
      return res.status(400).json({ error: 'Topic or pack content required.' })
    }
    const result = await generateRecallQuestions({ topic, packContent, count })
    res.json(result)
  } catch (err) {
    console.error('Recall questions error:', err)
    res.status(500).json({ error: 'Failed to generate recall questions.' })
  }
})

export default router
