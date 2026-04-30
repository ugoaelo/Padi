/**
 * /api/content — Multi-tenant content routes
 *
 * Public (no auth):
 *   GET  /schools                     — list all active schools
 *   GET  /schools/:schoolSlug         — school detail + departments
 *   GET  /schools/:schoolSlug/departments/:deptSlug/courses  — course list (preview)
 *   GET  /courses/search              — fuzzy search across course codes + titles
 *
 * Authenticated (requireAuth only — preview mode for non-subscribers):
 *   GET  /schools/:schoolSlug/departments/:deptSlug/courses/:courseId/questions
 *        → returns question metadata only (no solution text) for non-subscribers
 *        → returns full question for subscribers
 *
 * Authenticated + Subscribed:
 *   POST /questions/:questionId/solve  — generate or return cached solution
 *   GET  /questions/:questionId/solution — fetch cached solution
 *   POST /solutions/:solutionId/flag    — flag incorrect solution
 *   GET  /credits                       — user's solve credit summary
 *   GET  /user/courses                  — user's selected courses
 *   POST /user/courses                  — select a course
 *   DELETE /user/courses/:courseId      — deselect a course
 */

import { Router }    from 'express'
import { requireAuth, requireSubscription } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { solveTutorialQuestion } from '../services/content.js'

const router = Router()

// ── PUBLIC ROUTES (no auth) ───────────────────────────────────────────────────

// List all active schools
router.get('/schools', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('schools')
      .select('id, name, slug, short_name, state, logo_url')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    res.json({ schools: data })
  } catch (err) {
    console.error('Schools list error:', err)
    res.status(500).json({ error: 'Failed to load schools.' })
  }
})

// School detail + departments
router.get('/schools/:schoolSlug', async (req, res) => {
  try {
    const { data: school, error } = await supabaseAdmin
      .from('schools')
      .select(`
        id, name, slug, short_name, state, logo_url,
        departments ( id, name, slug, faculty )
      `)
      .eq('slug', req.params.schoolSlug)
      .eq('is_active', true)
      .single()
    if (error || !school) return res.status(404).json({ error: 'School not found.' })
    res.json({ school })
  } catch (err) {
    console.error('School detail error:', err)
    res.status(500).json({ error: 'Failed to load school.' })
  }
})

// Course list for a department — preview-safe (no TQ content)
router.get('/schools/:schoolSlug/departments/:deptSlug/courses', async (req, res) => {
  try {
    const { level, semester } = req.query

    // Resolve school + department
    const { data: school } = await supabaseAdmin
      .from('schools').select('id').eq('slug', req.params.schoolSlug).single()
    if (!school) return res.status(404).json({ error: 'School not found.' })

    const { data: dept } = await supabaseAdmin
      .from('departments')
      .select('id')
      .eq('school_id', school.id)
      .eq('slug', req.params.deptSlug)
      .single()
    if (!dept) return res.status(404).json({ error: 'Department not found.' })

    let query = supabaseAdmin
      .from('courses')
      .select(`
        id, course_code, course_title, level, semester, credit_units,
        tutorial_questions ( count )
      `)
      .eq('school_id', school.id)
      .eq('department_id', dept.id)
      .eq('is_active', true)
      .order('level')
      .order('semester')
      .order('course_code')

    if (level)    query = query.eq('level',    parseInt(level))
    if (semester) query = query.eq('semester', parseInt(semester))

    const { data: courses, error } = await query
    if (error) throw error

    res.json({ courses })
  } catch (err) {
    console.error('Courses list error:', err)
    res.status(500).json({ error: 'Failed to load courses.' })
  }
})

// Fuzzy course search — preview-safe
router.get('/courses/search', async (req, res) => {
  try {
    const { q, schoolId } = req.query
    if (!q || q.length < 2) return res.json({ courses: [] })

    let query = supabaseAdmin
      .from('courses')
      .select('id, course_code, course_title, level, semester, school_id')
      .eq('is_active', true)
      .or(`course_code.ilike.%${q}%,course_title.ilike.%${q}%`)
      .limit(20)

    if (schoolId) query = query.eq('school_id', schoolId)

    const { data, error } = await query
    if (error) throw error
    res.json({ courses: data })
  } catch (err) {
    console.error('Course search error:', err)
    res.status(500).json({ error: 'Search failed.' })
  }
})

// ── AUTH REQUIRED (preview mode) ──────────────────────────────────────────────

// Question list for a course
// - Non-subscribers: question text returned (preview), solution locked
// - Subscribers: full access
router.get('/courses/:courseId/questions', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params

    // Check if user has an active subscription
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('status, grace_period_until, plan_type')
      .eq('user_id', req.user.id)
      .single()

    const now = new Date()
    const isSubscribed = sub && (
      sub.status === 'active' ||
      (sub.status === 'past_due' && sub.grace_period_until && new Date(sub.grace_period_until) > now)
    )

    const { data: questions, error } = await supabaseAdmin
      .from('tutorial_questions')
      .select('id, question_text, question_image_url, topic, question_number, year')
      .eq('course_id', courseId)
      .eq('status', 'published')
      .order('question_number')

    if (error) throw error

    res.json({
      questions,
      isSubscribed,
      message: isSubscribed ? null : 'Subscribe to unlock AI solutions for these questions.',
    })
  } catch (err) {
    console.error('Questions list error:', err)
    res.status(500).json({ error: 'Failed to load questions.' })
  }
})

// ── SUBSCRIBED ROUTES ─────────────────────────────────────────────────────────

// Generate or return cached solution for a question
router.post(
  '/questions/:questionId/solve',
  requireAuth,
  requireSubscription,
  aiLimiter,
  async (req, res) => {
    try {
      const { questionId } = req.params
      const { context }    = req.body  // optional student-provided context

      // 1. Load question + course info
      const { data: question, error: qErr } = await supabaseAdmin
        .from('tutorial_questions')
        .select(`
          id, question_text, question_image_url, topic, school_id,
          courses ( id, course_code, course_title, level, semester, school_id )
        `)
        .eq('id', questionId)
        .eq('status', 'published')
        .single()

      if (qErr || !question) return res.status(404).json({ error: 'Question not found.' })

      // 2. Verify question belongs to user's school
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('school_id, plan_tier')
        .eq('id', req.user.id)
        .single()

      if (profile?.school_id !== question.school_id) {
        return res.status(403).json({ error: 'Access denied — school mismatch.' })
      }

      // 3. Check for cached solution first
      const { data: cached } = await supabaseAdmin
        .from('solutions')
        .select('id, solution_text, generated_at, flagged')
        .eq('question_id', questionId)
        .single()

      if (cached && !cached.flagged) {
        // Deduct credit and return cached solution
        const { data: currentSem } = await supabaseAdmin
          .from('school_calendars')
          .select('semester_label')
          .eq('school_id', question.school_id)
          .eq('is_current', true)
          .single()

        const semLabel = currentSem?.semester_label || 'default'
        const creditsTotal = profile?.plan_tier === 'premium' ? 5 : 3

        // Ensure credit row exists
        await supabaseAdmin
          .from('solve_credits')
          .upsert({
            user_id:        req.user.id,
            course_id:      question.courses.id,
            school_id:      question.school_id,
            semester_label: semLabel,
            credits_total:  creditsTotal,
          }, { onConflict: 'user_id,course_id,semester_label', ignoreDuplicates: true })

        // Deduct credit atomically
        const { data: credited } = await supabaseAdmin
          .rpc('deduct_solve_credit', {
            p_user_id:       req.user.id,
            p_course_id:     question.courses.id,
            p_semester_label: semLabel,
          })

        if (!credited) {
          return res.status(429).json({
            error: 'You have used all your solve credits for this course this semester.',
            code:  'CREDITS_EXHAUSTED',
          })
        }

        return res.json({
          solution: cached.solution_text,
          cached:   true,
          questionId,
        })
      }

      // 4. Generate new solution
      const solution = await solveTutorialQuestion({
        questionText:  question.question_text,
        courseCode:    question.courses.course_code,
        courseTitle:   question.courses.course_title,
        level:         question.courses.level,
        topic:         question.topic,
        context:       context || null,
        userId:        req.user.id,
      })

      // 5. Cache the solution
      const { data: saved } = await supabaseAdmin
        .from('solutions')
        .upsert({
          question_id:   questionId,
          school_id:     question.school_id,
          solution_text: solution,
          model_used:    'claude-haiku-4-5-20251001',
        }, { onConflict: 'question_id' })
        .select('id')
        .single()

      // 6. Deduct credit (only after successful generation)
      const { data: currentSem } = await supabaseAdmin
        .from('school_calendars')
        .select('semester_label')
        .eq('school_id', question.school_id)
        .eq('is_current', true)
        .single()

      const semLabel     = currentSem?.semester_label || 'default'
      const creditsTotal = profile?.plan_tier === 'premium' ? 5 : 3

      await supabaseAdmin
        .from('solve_credits')
        .upsert({
          user_id:        req.user.id,
          course_id:      question.courses.id,
          school_id:      question.school_id,
          semester_label: semLabel,
          credits_total:  creditsTotal,
        }, { onConflict: 'user_id,course_id,semester_label', ignoreDuplicates: true })

      await supabaseAdmin.rpc('deduct_solve_credit', {
        p_user_id:        req.user.id,
        p_course_id:      question.courses.id,
        p_semester_label: semLabel,
      })

      res.json({ solution, cached: false, questionId })
    } catch (err) {
      console.error('Solve error:', err)
      // Credit NOT deducted — error before deduction
      res.status(500).json({ error: 'Failed to generate solution. Please try again.' })
    }
  }
)

// Flag an incorrect solution
router.post('/solutions/:solutionId/flag', requireAuth, requireSubscription, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('solutions')
      .select('flag_count')
      .eq('id', req.params.solutionId)
      .single()

    await supabaseAdmin
      .from('solutions')
      .update({ flagged: true, flag_count: (existing?.flag_count ?? 0) + 1 })
      .eq('id', req.params.solutionId)

    res.json({ success: true })
  } catch (err) {
    console.error('Flag solution error:', err)
    res.status(500).json({ error: 'Failed to flag solution.' })
  }
})

// User's solve credit summary
router.get('/credits', requireAuth, requireSubscription, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('solve_credits')
      .select(`
        id, credits_total, credits_used, semester_label,
        courses ( id, course_code, course_title )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json({ credits: data })
  } catch (err) {
    console.error('Credits error:', err)
    res.status(500).json({ error: 'Failed to load credits.' })
  }
})

// User's selected courses
router.get('/user/courses', requireAuth, requireSubscription, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_courses')
      .select(`
        id,
        courses (
          id, course_code, course_title, level, semester,
          departments ( name )
        )
      `)
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false })

    if (error) throw error
    res.json({ courses: data.map(r => r.courses) })
  } catch (err) {
    console.error('User courses error:', err)
    res.status(500).json({ error: 'Failed to load your courses.' })
  }
})

const MAX_COURSES_PER_STUDENT = 9

// Add a course to user's dashboard
router.post('/user/courses', requireAuth, requireSubscription, async (req, res) => {
  try {
    const { courseId } = req.body
    if (!courseId) return res.status(400).json({ error: 'courseId required.' })

    // Enforce 9-course cap — contact support to add more
    const { count } = await supabaseAdmin
      .from('user_courses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    if (count >= MAX_COURSES_PER_STUDENT) {
      console.warn(`COURSE_LIMIT_REACHED user=${req.user.id} count=${count} limit=${MAX_COURSES_PER_STUDENT} courseId=${courseId}`)
      return res.status(409).json({
        error: `You've reached the ${MAX_COURSES_PER_STUDENT}-course limit for this semester. Contact us at support@yourpadi.com to add more.`,
        code:  'COURSE_LIMIT_REACHED',
      })
    }

    // Verify course belongs to user's school
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('school_id').eq('id', req.user.id).single()

    const { data: course } = await supabaseAdmin
      .from('courses').select('id, school_id').eq('id', courseId).single()

    if (!course || course.school_id !== profile?.school_id) {
      return res.status(403).json({ error: 'Course not available for your school.' })
    }

    await supabaseAdmin
      .from('user_courses')
      .upsert({
        user_id:   req.user.id,
        course_id: courseId,
        school_id: course.school_id,
      }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

    res.json({ success: true })
  } catch (err) {
    console.error('Add course error:', err)
    res.status(500).json({ error: 'Failed to add course.' })
  }
})

// Remove a course from user's dashboard
router.delete('/user/courses/:courseId', requireAuth, requireSubscription, async (req, res) => {
  try {
    await supabaseAdmin
      .from('user_courses')
      .delete()
      .eq('user_id', req.user.id)
      .eq('course_id', req.params.courseId)
    res.json({ success: true })
  } catch (err) {
    console.error('Remove course error:', err)
    res.status(500).json({ error: 'Failed to remove course.' })
  }
})

export default router
