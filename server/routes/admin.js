import { Router }    from 'express'
import multer        from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { apiLimiter }  from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { callAI }      from '../services/ai.js'
import { sendAdminDeletionEmail, sendPauseConfirmationEmail, sendResumeConfirmationEmail } from '../services/email.js'
import { extractTextFromBuffer } from '../services/fileParser.js'
import { uploadToR2 }  from '../services/storage.js'
import {
  parseTutorialQuestions,
  saveDraftQuestions,
  publishQuestions,
  updateQuestion,
  inferLevelFromCourseCode,
} from '../services/content.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()

async function requireAdmin(req, res, next) {
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.user.id).single()
    if (!profile?.is_admin) return res.status(403).json({ error: 'Admin access required.' })
    next()
  } catch (err) { res.status(500).json({ error: 'Admin check failed.' }) }
}

router.use(requireAuth, requireAdmin, apiLimiter)

router.get('/stats', async (req, res) => {
  try {
    const [users, subs, waitlist, flags, cache, founding] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('waitlist').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('flagged_answers').select('*', { count: 'exact', head: true }).eq('reviewed', false),
      supabaseAdmin.from('ai_cache').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('founding_member', true),
    ])
    res.json({ totalUsers: users.count || 0, activeSubscribers: subs.count || 0, waitlistSignups: waitlist.count || 0, pendingFlags: flags.count || 0, cachedResponses: cache.count || 0, foundingMembers: founding.count || 0 })
  } catch (err) { console.error('Admin stats error:', err); res.status(500).json({ error: 'Failed to load stats.' }) }
})

router.get('/users', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, first_name, last_name, email, university, course, founding_member, is_admin, created_at, subscriptions(status, current_period_end)').order('created_at', { ascending: false }).limit(100)
    res.json({ users: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load users.' }) }
})

// ── Grant or revoke admin access ─────────────────────────────────
router.patch('/users/:id/set-admin', async (req, res) => {
  try {
    const { isAdmin } = req.body
    if (typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'isAdmin (boolean) required.' })
    // Prevent self-demotion — admins cannot remove their own access
    if (req.params.id === req.user.id && !isAdmin) return res.status(400).json({ error: 'You cannot remove your own admin access.' })
    await supabaseAdmin.from('profiles').update({ is_admin: isAdmin }).eq('id', req.params.id)
    res.json({ success: true, isAdmin })
  } catch (err) { res.status(500).json({ error: 'Failed to update admin status.' }) }
})

router.get('/waitlist', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('waitlist').select('*').order('created_at', { ascending: false })
    res.json({ waitlist: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load waitlist.' }) }
})

router.get('/flagged', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('flagged_answers').select('*, profiles(full_name, university)').eq('reviewed', false).order('created_at', { ascending: false }).limit(50)
    res.json({ flagged: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load flagged answers.' }) }
})

router.post('/flagged/:id/review', async (req, res) => {
  try {
    await supabaseAdmin.from('flagged_answers').update({ reviewed: true }).eq('id', req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to mark as reviewed.' }) }
})

router.post('/batch-upload', async (req, res) => {
  try {
    const { documents } = req.body
    if (!documents?.length) return res.status(400).json({ error: 'Documents array required.' })
    const results = []
    for (const doc of documents.slice(0, 20)) {
      try {
        const summaryResult = await callAI({
          systemPrompt: 'You are Padi. Generate a concise, structured summary of this educational content for students. Format in clean markdown.',
          userPrompt:   `Summarise this ${doc.subject || ''} content titled "${doc.title}":\n\n${doc.content.substring(0, 4000)}`,
          taskType:     'summary',
          useCache:     true,
          maxTokens:    800,
        })
        const { data } = await supabaseAdmin.from('knowledge_base').upsert({ title: doc.title, subject: doc.subject || null, level: doc.level || null, type: doc.type || 'document', content: doc.content.substring(0, 10000), summary: summaryResult.response, added_by: req.user.id }, { onConflict: 'title' }).select().single()
        results.push({ title: doc.title, success: true, id: data?.id })
      } catch (docErr) { results.push({ title: doc.title, success: false, error: docErr.message }) }
    }
    res.json({ results, processed: results.length })
  } catch (err) { console.error('Batch upload error:', err); res.status(500).json({ error: 'Batch upload failed.' }) }
})

router.get('/knowledge-base', async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('knowledge_base').select('id, title, subject, level, type, created_at').order('created_at', { ascending: false }).limit(100)
    res.json({ documents: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load knowledge base.' }) }
})

router.delete('/knowledge-base/:id', async (req, res) => {
  try {
    await supabaseAdmin.from('knowledge_base').delete().eq('id', req.params.id)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to delete document.' }) }
})

router.post('/cache/clear', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - olderThanDays)
    await supabaseAdmin.from('ai_cache').delete().lt('created_at', cutoff.toISOString())
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to clear cache.' }) }
})

// ── SCHOOL & CONTENT MANAGEMENT ───────────────────────────────────────────────

// List all schools
router.get('/schools', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('schools')
      .select('*, departments(id, name, slug, courses(count))')
      .order('name')
    res.json({ schools: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load schools.' }) }
})

// Create a school
router.post('/schools', async (req, res) => {
  try {
    const { name, slug, short_name, state } = req.body
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required.' })
    const { data, error } = await supabaseAdmin
      .from('schools').insert({ name, slug, short_name, state }).select().single()
    if (error) throw error
    res.json({ school: data })
  } catch (err) { res.status(500).json({ error: 'Failed to create school.' }) }
})

// Create a department
router.post('/schools/:schoolId/departments', async (req, res) => {
  try {
    const { name, slug, faculty } = req.body
    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert({ school_id: req.params.schoolId, name, slug, faculty })
      .select().single()
    if (error) throw error
    res.json({ department: data })
  } catch (err) { res.status(500).json({ error: 'Failed to create department.' }) }
})

// Create a course (level auto-inferred from course code if not provided)
// e.g. CMP 201 → level 200, PHY 112 → level 100
router.post('/schools/:schoolId/departments/:departmentId/courses', async (req, res) => {
  try {
    const { course_code, course_title, semester, credit_units } = req.body
    if (!course_code || !course_title) {
      return res.status(400).json({ error: 'course_code and course_title required.' })
    }

    // Auto-infer level from course code number (first digit × 100)
    const level = inferLevelFromCourseCode(course_code)

    const { data, error } = await supabaseAdmin
      .from('courses')
      .insert({
        school_id:     req.params.schoolId,
        department_id: req.params.departmentId,
        course_code:   course_code.toUpperCase().trim(),
        course_title:  course_title.trim(),
        level,          // null if code has no numeric part
        semester:      semester || null,
        credit_units:  credit_units || null,
      })
      .select()
      .single()

    if (error) throw error
    res.json({ course: data, inferredLevel: level })
  } catch (err) {
    console.error('Create course error:', err)
    res.status(500).json({ error: 'Failed to create course.' })
  }
})

// ── TQ UPLOAD PIPELINE ────────────────────────────────────────────────────────
// Step 1: Upload file → parse → return draft questions for preview
router.post(
  '/content/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const { courseId, schoolId } = req.body
      if (!courseId || !schoolId) return res.status(400).json({ error: 'courseId and schoolId required.' })
      if (!req.file) return res.status(400).json({ error: 'File required.' })

      // Verify course belongs to school
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id, course_code, course_title, school_id')
        .eq('id', courseId)
        .eq('school_id', schoolId)
        .single()
      if (!course) return res.status(404).json({ error: 'Course not found for this school.' })

      // ── Duplicate detection ───────────────────────────────────────
      // Count existing published + draft questions for this course.
      // If questions exist, return a warning unless the caller explicitly
      // passes ?mode=augment (add alongside) or ?mode=replace (delete drafts first).
      const { count: existingCount } = await supabaseAdmin
        .from('tutorial_questions')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .in('status', ['published', 'draft'])

      const mode = req.body.mode || 'check' // 'check' | 'augment' | 'replace'

      if (existingCount > 0 && mode === 'check') {
        // First upload attempt — warn the admin and wait for their explicit choice
        const { count: draftCount } = await supabaseAdmin
          .from('tutorial_questions')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('status', 'draft')

        const { count: publishedCount } = await supabaseAdmin
          .from('tutorial_questions')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('status', 'published')

        return res.status(409).json({
          code:           'QUESTIONS_EXIST',
          message:        `${course.course_code} already has ${existingCount} question(s) (${publishedCount} published, ${draftCount} draft). Choose how to proceed.`,
          existingCount,
          publishedCount,
          draftCount,
          courseCode:     course.course_code,
        })
      }

      if (existingCount > 0 && mode === 'replace') {
        // Delete all existing drafts for this course (keep published — admin must archive those manually)
        await supabaseAdmin
          .from('tutorial_questions')
          .delete()
          .eq('course_id', courseId)
          .eq('status', 'draft')
      }
      // mode === 'augment' → fall through and append new questions to existing ones

      // Extract text from uploaded file
      const rawText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname)
      if (!rawText || rawText.length < 20) {
        return res.status(400).json({ error: 'Could not extract text from file. Try a cleaner scan or typed document.' })
      }

      // Parse into structured questions using AI
      const parsed = await parseTutorialQuestions({
        rawContent:   rawText,
        courseCode:   course.course_code,
        courseTitle:  course.course_title,
      })

      if (!parsed?.length) {
        return res.status(400).json({ error: 'No questions found in the uploaded content.' })
      }

      // Save as drafts
      const drafts = await saveDraftQuestions({
        questions:   parsed,
        courseId,
        schoolId,
        uploadedBy:  req.user.id,
      })

      res.json({
        message:    `${drafts.length} questions parsed and saved as drafts. Review and publish below.`,
        questions:  drafts,
        courseCode: course.course_code,
      })
    } catch (err) {
      console.error('TQ upload error:', err)
      res.status(500).json({ error: err.message || 'Upload failed.' })
    }
  }
)

// Step 2: Edit a draft question (fix typos etc.)
router.patch('/content/questions/:questionId', async (req, res) => {
  try {
    const updated = await updateQuestion(req.params.questionId, req.body)
    res.json({ question: updated })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update question.' })
  }
})

// Step 3: Publish selected draft questions
router.post('/content/publish', async (req, res) => {
  try {
    const { questionIds } = req.body
    if (!questionIds?.length) return res.status(400).json({ error: 'questionIds array required.' })
    const result = await publishQuestions(questionIds)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish questions.' })
  }
})

// List draft questions for a course (admin preview)
router.get('/content/courses/:courseId/drafts', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('tutorial_questions')
      .select('id, question_number, question_text, topic, status, created_at')
      .eq('course_id', req.params.courseId)
      .eq('status', 'draft')
      .order('question_number')
    res.json({ questions: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load drafts.' }) }
})

// List published questions for a course (admin view)
router.get('/content/courses/:courseId/published', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('tutorial_questions')
      .select('id, question_number, question_text, topic, flagged, published_at')
      .eq('course_id', req.params.courseId)
      .eq('status', 'published')
      .order('question_number')
    res.json({ questions: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load questions.' }) }
})

// Unpublish / archive a question
router.patch('/content/questions/:questionId/archive', async (req, res) => {
  try {
    await supabaseAdmin
      .from('tutorial_questions')
      .update({ status: 'archived' })
      .eq('id', req.params.questionId)
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to archive question.' }) }
})

// Review a flagged solution
router.patch('/content/solutions/:solutionId/review', async (req, res) => {
  try {
    const { action } = req.body // 'clear' | 'regenerate'
    if (action === 'clear') {
      await supabaseAdmin
        .from('solutions')
        .update({ flagged: false, flag_count: 0 })
        .eq('id', req.params.solutionId)
    } else if (action === 'regenerate') {
      await supabaseAdmin
        .from('solutions')
        .delete()
        .eq('id', req.params.solutionId)
      // Next student to click Solve regenerates it fresh
    }
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: 'Failed to review solution.' }) }
})

// ── Upload an image for a TQ question ────────────────────────────
// Accepts a single image file, uploads to R2, saves URL to question record.
router.post(
  '/content/questions/:questionId/image',
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file required.' })
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Only image files are supported.' })
      }

      const imageUrl = await uploadToR2(req.file.buffer, req.file.mimetype, 'tq-images')

      await supabaseAdmin
        .from('tutorial_questions')
        .update({ question_image_url: imageUrl })
        .eq('id', req.params.questionId)

      res.json({ imageUrl })
    } catch (err) {
      console.error('TQ image upload error:', err)
      res.status(500).json({ error: err.message || 'Image upload failed.' })
    }
  }
)

// School calendar management
router.post('/schools/:schoolId/calendar', async (req, res) => {
  try {
    const { academic_year, semester, semester_label, start_date, end_date, is_current } = req.body
    const { data, error } = await supabaseAdmin
      .from('school_calendars')
      .upsert({
        school_id: req.params.schoolId,
        academic_year,
        semester,
        semester_label,
        start_date,
        end_date,
        is_current: is_current || false,
      }, { onConflict: 'school_id,semester_label' })
      .select().single()
    if (error) throw error
    res.json({ calendar: data })
  } catch (err) { res.status(500).json({ error: 'Failed to save calendar.' }) }
})

router.get('/schools/:schoolId/calendar', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('school_calendars')
      .select('*')
      .eq('school_id', req.params.schoolId)
      .order('start_date', { ascending: false })
    res.json({ calendars: data || [] })
  } catch (err) { res.status(500).json({ error: 'Failed to load calendar.' }) }
})

// ── STUDENT / USER MANAGEMENT ─────────────────────────────────────────────────
// Full CRUD for student profiles, courses, and subscriptions.

// List all students with optional filters
// Query params: school_id, department_id, level, course_id, search (name/email), deleted
router.get('/students', async (req, res) => {
  try {
    const { school_id, department_id, level, course_id, search, deleted } = req.query

    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id, first_name, last_name, full_name, preferred_name, email,
        university, course, level, founding_member, is_admin,
        summer_semester, deleted_at, created_at,
        school_id, department_id,
        subscriptions ( status, plan_type, current_period_end, grace_period_until )
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    // Filters
    if (school_id)     query = query.eq('school_id', school_id)
    if (department_id) query = query.eq('department_id', department_id)
    if (level)         query = query.eq('level', level)
    if (deleted === 'true') {
      query = query.not('deleted_at', 'is', null)
    } else {
      query = query.is('deleted_at', null)
    }
    if (search) {
      // Search by name or email (case-insensitive partial match)
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }

    // course_id filter: join through user_courses
    if (course_id) {
      const { data: enrolled } = await supabaseAdmin
        .from('user_courses')
        .select('user_id')
        .eq('course_id', course_id)
      const ids = (enrolled || []).map(r => r.user_id)
      if (ids.length === 0) return res.json({ students: [] })
      query = query.in('id', ids)
    }

    const { data, error } = await query
    if (error) throw error
    res.json({ students: data || [] })
  } catch (err) {
    console.error('Admin students list error:', err)
    res.status(500).json({ error: 'Failed to load students.' })
  }
})

// Get a single student's full profile + courses
router.get('/students/:id', async (req, res) => {
  try {
    const [profileRes, coursesRes, subRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', req.params.id)
        .single(),
      supabaseAdmin
        .from('user_courses')
        .select('course_id, courses ( course_code, course_title, level )')
        .eq('user_id', req.params.id),
      supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', req.params.id)
        .single(),
    ])
    if (!profileRes.data) return res.status(404).json({ error: 'Student not found.' })
    res.json({
      student:      profileRes.data,
      courses:      coursesRes.data || [],
      subscription: subRes.data || null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load student.' })
  }
})

// Edit a student's profile fields + summer_semester flag
router.patch('/students/:id', async (req, res) => {
  try {
    const allowed = [
      'first_name', 'last_name', 'preferred_name', 'email',
      'university', 'course', 'level', 'school_id', 'department_id',
      'summer_semester', 'whatsapp',
    ]
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' })
    }
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json({ student: data })
  } catch (err) {
    console.error('Admin edit student error:', err)
    res.status(500).json({ error: 'Failed to update student.' })
  }
})

// List a student's enrolled courses
router.get('/students/:id/courses', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('user_courses')
      .select('course_id, courses ( id, course_code, course_title, level, semester )')
      .eq('user_id', req.params.id)
    res.json({ courses: data || [] })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load student courses.' })
  }
})

// Add a course for a student (admin bypass — no school validation, no 9-course cap)
router.post('/students/:id/courses', async (req, res) => {
  try {
    const { courseId } = req.body
    if (!courseId) return res.status(400).json({ error: 'courseId required.' })
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, school_id')
      .eq('id', courseId)
      .single()
    if (!course) return res.status(404).json({ error: 'Course not found.' })
    await supabaseAdmin
      .from('user_courses')
      .upsert({ user_id: req.params.id, course_id: courseId, school_id: course.school_id },
              { onConflict: 'user_id,course_id', ignoreDuplicates: true })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to add course.' })
  }
})

// Remove a course from a student's dashboard
router.delete('/students/:id/courses/:courseId', async (req, res) => {
  try {
    await supabaseAdmin
      .from('user_courses')
      .delete()
      .eq('user_id', req.params.id)
      .eq('course_id', req.params.courseId)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove course.' })
  }
})

// Manage a student's subscription
// body: { action: 'grant' | 'extend' | 'suspend' | 'change_tier' | 'pause' | 'resume', tier?: 'base'|'premium', days?: number, months?: 1|2|3 }
router.patch('/students/:id/subscription', async (req, res) => {
  try {
    const { action, tier, days = 30, months = 1 } = req.body
    const now = new Date()

    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.params.id)
      .single()

    if (action === 'grant') {
      // Create or reactivate subscription
      const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id:            req.params.id,
          status:             'active',
          plan_type:          tier || existing?.plan_type || 'base',
          current_period_end: periodEnd.toISOString(),
          grace_period_until: null,
        }, { onConflict: 'user_id' })
      // Also update plan_tier on profile
      if (tier) {
        await supabaseAdmin.from('profiles').update({ plan_tier: tier }).eq('id', req.params.id)
      }
    } else if (action === 'extend') {
      const base = existing?.current_period_end
        ? new Date(Math.max(now.getTime(), new Date(existing.current_period_end).getTime()))
        : now
      const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'active', current_period_end: newEnd.toISOString() })
        .eq('user_id', req.params.id)
    } else if (action === 'suspend') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'paused' })
        .eq('user_id', req.params.id)
    } else if (action === 'change_tier') {
      if (!tier) return res.status(400).json({ error: 'tier required for change_tier action.' })
      await supabaseAdmin
        .from('subscriptions')
        .update({ plan_type: tier })
        .eq('user_id', req.params.id)
      await supabaseAdmin
        .from('profiles')
        .update({ plan_tier: tier })
        .eq('id', req.params.id)
    } else if (action === 'pause') {
      // Admin-initiated pause: same Padi-level pause as self-service
      const pauseMonths = Math.min(3, Math.max(1, Number(months)))
      const pausedUntil = new Date()
      pausedUntil.setMonth(pausedUntil.getMonth() + pauseMonths)
      await supabaseAdmin
        .from('subscriptions')
        .update({
          paused_until: pausedUntil.toISOString(),
          paused_at:    new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq('user_id', req.params.id)
      // Notify the student (non-blocking)
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(req.params.id)
        const { data: prof } = await supabaseAdmin.from('profiles').select('first_name, preferred_name, full_name').eq('id', req.params.id).single()
        if (authUser?.email) {
          sendPauseConfirmationEmail({ email: authUser.email, firstName: prof?.first_name, preferredName: prof?.preferred_name, fullName: prof?.full_name, pausedUntil: pausedUntil.toISOString(), months: pauseMonths })
            .catch(e => console.error('Admin pause email error (non-blocking):', e.message))
        }
      } catch (e) { console.warn('Admin pause email setup error:', e.message) }
    } else if (action === 'resume') {
      // Admin-initiated resume: clears pause, extends period_end by remaining pause time
      if (!existing) return res.status(404).json({ error: 'No subscription found.' })
      const pausedUntil = existing.paused_until ? new Date(existing.paused_until) : null
      const updates = { paused_until: null, paused_at: null, updated_at: new Date().toISOString() }
      let newPeriodEnd = null
      if (pausedUntil && pausedUntil > now && existing.current_period_end) {
        const remainingMs  = pausedUntil.getTime() - now.getTime()
        newPeriodEnd = new Date(new Date(existing.current_period_end).getTime() + remainingMs)
        updates.current_period_end = newPeriodEnd.toISOString()
      }
      await supabaseAdmin.from('subscriptions').update(updates).eq('user_id', req.params.id)
      // Notify the student (non-blocking)
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(req.params.id)
        const { data: prof } = await supabaseAdmin.from('profiles').select('first_name, preferred_name, full_name').eq('id', req.params.id).single()
        if (authUser?.email && newPeriodEnd) {
          sendResumeConfirmationEmail({ email: authUser.email, firstName: prof?.first_name, preferredName: prof?.preferred_name, fullName: prof?.full_name, newPeriodEnd: newPeriodEnd.toISOString() })
            .catch(e => console.error('Admin resume email error (non-blocking):', e.message))
        }
      } catch (e) { console.warn('Admin resume email setup error:', e.message) }
    } else {
      return res.status(400).json({ error: 'Invalid action. Use: grant | extend | suspend | change_tier | pause | resume' })
    }

    res.json({ success: true, action })
  } catch (err) {
    console.error('Admin subscription management error:', err)
    res.status(500).json({ error: 'Failed to update subscription.' })
  }
})

// Soft-delete a student account from admin (same mechanics as self-deletion)
router.delete('/students/:id', async (req, res) => {
  try {
    // Prevent self-deletion via admin panel
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account from the admin panel.' })
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at, first_name, preferred_name, full_name')
      .eq('id', req.params.id)
      .single()
    if (!profile) return res.status(404).json({ error: 'Student not found.' })
    if (profile.deleted_at) return res.status(409).json({ error: 'Account is already scheduled for deletion.' })

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await supabaseAdmin
      .from('profiles')
      .update({
        deleted_at:                new Date().toISOString(),
        deletion_token:            null, // admin deletion has no reactivation token
        deletion_token_expires_at: expires.toISOString(),
      })
      .eq('id', req.params.id)

    // ── Notify the student (non-blocking) ─────────────────────────
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(req.params.id)
      if (authUser?.email) {
        sendAdminDeletionEmail({
          email:         authUser.email,
          firstName:     profile.first_name,
          preferredName: profile.preferred_name,
          fullName:      profile.full_name,
        }).catch(e => console.error('Admin deletion email error (non-blocking):', e.message))
      }
    } catch (emailErr) {
      console.warn('Admin deletion email setup error (non-blocking):', emailErr.message)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Admin delete student error:', err)
    res.status(500).json({ error: 'Failed to delete student.' })
  }
})

export default router
