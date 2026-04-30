import { Router }   from 'express'
import crypto        from 'crypto'
import { requireAuth, requireSubscription } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { sendAccountDeletionEmail } from '../services/email.js'

const router  = Router()
const API_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// ── PUBLIC: reactivate account (no auth — user is locked out) ────
// Token is sent via email on deletion request.
// This must come BEFORE any router.use() middleware.
router.get('/reactivate/:token', apiLimiter, async (req, res) => {
  try {
    const { token } = req.params
    if (!token) return res.status(400).json({ error: 'Token required.' })

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, deleted_at, deletion_token, deletion_token_expires_at')
      .eq('deletion_token', token)
      .single()

    if (error || !profile) {
      return res.redirect(`${API_URL}/login?reactivate=invalid`)
    }

    if (!profile.deleted_at) {
      // Account was never deleted (or already reactivated) — just redirect to login
      return res.redirect(`${API_URL}/login?reactivate=already-active`)
    }

    const expired = profile.deletion_token_expires_at
      ? new Date(profile.deletion_token_expires_at) < new Date()
      : true

    if (expired) {
      return res.redirect(`${API_URL}/login?reactivate=expired`)
    }

    // ── Reactivate ────────────────────────────────────────────────
    await supabaseAdmin
      .from('profiles')
      .update({
        deleted_at:                  null,
        deletion_token:              null,
        deletion_token_expires_at:   null,
      })
      .eq('id', profile.id)

    return res.redirect(`${API_URL}/login?reactivate=success`)
  } catch (err) {
    console.error('Reactivation error:', err)
    return res.redirect(`${API_URL}/login?reactivate=error`)
  }
})

// ── AUTHENTICATED: delete own account (soft delete) ──────────────
// requireAuth only — no subscription required.
// User must be signed in to initiate deletion.
router.delete('/account', requireAuth, apiLimiter, async (req, res) => {
  try {
    const userId = req.user.id

    // Fetch profile for email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, preferred_name, full_name')
      .eq('id', userId)
      .single()

    if (!profile) return res.status(404).json({ error: 'Profile not found.' })

    // Generate a secure reactivation token (URL-safe base64)
    const token   = crypto.randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await supabaseAdmin
      .from('profiles')
      .update({
        deleted_at:                  new Date().toISOString(),
        deletion_token:              token,
        deletion_token_expires_at:   expires.toISOString(),
      })
      .eq('id', userId)

    // Fire deletion email (non-blocking)
    const reactivateUrl = `${process.env.SERVER_URL || 'http://localhost:4000'}/api/user/reactivate/${token}`
    sendAccountDeletionEmail({
      email:         profile.email,
      firstName:     profile.first_name,
      preferredName: profile.preferred_name,
      fullName:      profile.full_name,
      reactivateUrl,
    }).catch(err => console.error('Deletion email error:', err))

    res.json({ success: true, message: 'Account scheduled for deletion. Check your email for a reactivation link valid for 30 days.' })
  } catch (err) {
    console.error('Account deletion error:', err)
    res.status(500).json({ error: 'Failed to delete account.' })
  }
})

// ── All routes below require auth + active subscription ──────────
router.use(requireAuth, requireSubscription, apiLimiter)

// ── GET /api/user/progress ────────────────────────────────────────
// Aggregates study stats for the dashboard progress section.
// Returns: exams, scores, topics, review queue, last topic, AI quota.
router.get('/progress', async (req, res) => {
  try {
    const userId = req.user.id

    // Run all queries in parallel for speed
    const [
      examsResult,
      topicsResult,
      reviewResult,
      packsResult,
      prefsResult,
    ] = await Promise.all([
      // Completed exams + average score
      supabaseAdmin
        .from('exam_sessions')
        .select('score')
        .eq('user_id', userId)
        .not('completed_at', 'is', null),

      // Distinct topics from user_documents (uploaded/gleaned material)
      supabaseAdmin
        .from('user_documents')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Review items due today
      supabaseAdmin
        .from('review_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('next_review_date', new Date().toISOString()),

      // Study packs generated
      supabaseAdmin
        .from('study_packs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // User preferences (last topic + AI quota)
      supabaseAdmin
        .from('user_preferences')
        .select('last_topic, last_subject, last_section, ai_calls_today, ai_calls_date')
        .eq('user_id', userId)
        .single(),
    ])

    const exams       = examsResult.data || []
    const avgScore    = exams.length
      ? Math.round(exams.reduce((sum, e) => sum + (e.score || 0), 0) / exams.length)
      : null
    const topicsCount = topicsResult.count || 0
    const reviewDue   = reviewResult.count  || 0
    const packsCount  = packsResult.count   || 0

    // ── AI quota: reset counter if it's a new day ────────────────
    const prefs         = prefsResult.data
    const today         = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
    const isNewDay      = !prefs || prefs.ai_calls_date?.slice(0, 10) !== today
    const aiCallsToday  = isNewDay ? 0 : (prefs?.ai_calls_today || 0)
    const AI_DAILY_LIMIT = 40
    const aiRemaining   = Math.max(0, AI_DAILY_LIMIT - aiCallsToday)

    res.json({
      examsCompleted:  exams.length,
      avgScore,
      topicsStudied:   topicsCount,
      reviewItemsDue:  reviewDue,
      packsGenerated:  packsCount,
      lastTopic:       prefs?.last_topic    || null,
      lastSubject:     prefs?.last_subject  || null,
      lastSection:     prefs?.last_section  || null,
      aiCallsToday,
      aiRemaining,
      aiDailyLimit:    AI_DAILY_LIMIT,
    })
  } catch (err) {
    console.error('User progress error:', err)
    res.status(500).json({ error: 'Failed to load progress.' })
  }
})

// ── POST /api/user/preferences ────────────────────────────────────
// Saves the student's last active topic/section for "resume" feature.
// Also increments the daily AI call counter (called after each AI use).
router.post('/preferences', async (req, res) => {
  try {
    const { lastTopic, lastSubject, lastSection, incrementAI } = req.body
    const today = new Date().toISOString().slice(0, 10)

    // Fetch existing to handle day rollover on AI counter
    const { data: existing } = await supabaseAdmin
      .from('user_preferences')
      .select('ai_calls_today, ai_calls_date')
      .eq('user_id', req.user.id)
      .single()

    const isNewDay   = !existing || existing.ai_calls_date?.slice(0, 10) !== today
    const newCount   = incrementAI
      ? (isNewDay ? 1 : (existing?.ai_calls_today || 0) + 1)
      : (isNewDay ? 0 : (existing?.ai_calls_today || 0))

    const updates = {
      user_id:       req.user.id,
      ai_calls_today: newCount,
      ai_calls_date:  today,
      updated_at:     new Date().toISOString(),
    }
    if (lastTopic   !== undefined) updates.last_topic   = lastTopic
    if (lastSubject !== undefined) updates.last_subject = lastSubject
    if (lastSection !== undefined) updates.last_section = lastSection

    await supabaseAdmin
      .from('user_preferences')
      .upsert(updates, { onConflict: 'user_id' })

    res.json({ success: true })
  } catch (err) {
    console.error('User preferences error:', err)
    res.status(500).json({ error: 'Failed to save preferences.' })
  }
})

export default router
