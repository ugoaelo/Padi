/**
 * contentApi.js — API helpers for the TQ content pipeline.
 * All authenticated routes use authFetch (10 s timeout).
 * Public browsing routes use plain fetch.
 */

import { supabase } from './supabase.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

async function authFetch(path, options = {}) {
  const token      = await getAuthToken()
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — check your connection')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function publicFetch(path) {
  const res  = await fetch(`${API_URL}${path}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ── PUBLIC: school browser ────────────────────────────────────────
export async function getSchools() {
  return publicFetch('/api/content/schools')
}

export async function getSchool(slug) {
  return publicFetch(`/api/content/schools/${slug}`)
}

export async function getDepartmentCourses(schoolSlug, deptSlug) {
  return publicFetch(`/api/content/schools/${schoolSlug}/departments/${deptSlug}/courses`)
}

export async function searchCourses(q) {
  return publicFetch(`/api/content/courses/search?q=${encodeURIComponent(q)}`)
}

// ── AUTH: questions for a course ──────────────────────────────────
export async function getCourseQuestions(courseId) {
  return authFetch(`/api/content/courses/${courseId}/questions`)
}

// ── AUTH: solve a question ────────────────────────────────────────
// Returns { solution, cached, creditsRemaining, isFoundingMember }
export async function solveQuestion(questionId, context = '') {
  return authFetch(`/api/content/questions/${questionId}/solve`, {
    method: 'POST',
    body:   JSON.stringify({ context }),
  })
}

// ── AUTH: flag a solution ─────────────────────────────────────────
export async function flagSolution(solutionId, reason) {
  return authFetch(`/api/content/solutions/${solutionId}/flag`, {
    method: 'POST',
    body:   JSON.stringify({ reason }),
  })
}

// ── AUTH: solve credits ───────────────────────────────────────────
export async function getSolveCredits() {
  return authFetch('/api/content/credits')
}

// ── AUTH: user course management ─────────────────────────────────
export async function getUserCourses() {
  return authFetch('/api/content/user/courses')
}

export async function addUserCourse(courseId) {
  return authFetch('/api/content/user/courses', {
    method: 'POST',
    body:   JSON.stringify({ courseId }),
  })
}

export async function removeUserCourse(courseId) {
  return authFetch(`/api/content/user/courses/${courseId}`, {
    method: 'DELETE',
  })
}

// ── ADMIN: TQ upload pipeline ─────────────────────────────────────
// mode: 'check' (default — warns if questions exist) | 'augment' | 'replace'
export async function uploadTQFile({ courseId, schoolId, file, mode = 'check' }) {
  const token = await getAuthToken()
  const form  = new FormData()
  form.append('courseId', courseId)
  form.append('schoolId', schoolId)
  form.append('mode',     mode)
  form.append('file', file)

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 60_000) // 60 s for large files
  try {
    const res = await fetch(`${API_URL}/api/admin/content/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
      signal:  controller.signal,
    })
    const data = await res.json()
    if (res.status === 409 && data.code === 'QUESTIONS_EXIST') {
      // Surface conflict data — caller decides what to do
      const err = new Error(data.message)
      err.code           = data.code
      err.existingCount  = data.existingCount
      err.publishedCount = data.publishedCount
      err.draftCount     = data.draftCount
      throw err
    }
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Upload timed out — try a smaller file')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function patchQuestion(questionId, updates) {
  return authFetch(`/api/admin/content/questions/${questionId}`, {
    method: 'PATCH',
    body:   JSON.stringify(updates),
  })
}

export async function uploadQuestionImage(questionId, imageFile) {
  const token = await getAuthToken()
  const form  = new FormData()
  form.append('image', imageFile)
  const res   = await fetch(`${API_URL}/api/admin/content/questions/${questionId}/image`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Image upload failed')
  return data
}

export async function publishQuestions(questionIds) {
  return authFetch('/api/admin/content/publish', {
    method: 'POST',
    body:   JSON.stringify({ questionIds }),
  })
}

export async function getAdminSchools() {
  return authFetch('/api/admin/schools')
}

export async function createSchool(data) {
  return authFetch('/api/admin/schools', {
    method: 'POST',
    body:   JSON.stringify(data),
  })
}

export async function createDepartment(schoolId, data) {
  return authFetch(`/api/admin/schools/${schoolId}/departments`, {
    method: 'POST',
    body:   JSON.stringify(data),
  })
}

export async function getCourseDrafts(courseId) {
  return authFetch(`/api/admin/content/courses/${courseId}/drafts`)
}

// ── ADMIN: student / user management ─────────────────────────────
// filters: { school_id, department_id, level, course_id, search, deleted }
export async function getAdminStudents(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
  return authFetch(`/api/admin/students?${params.toString()}`)
}

export async function getAdminStudent(userId) {
  return authFetch(`/api/admin/students/${userId}`)
}

export async function updateAdminStudent(userId, updates) {
  return authFetch(`/api/admin/students/${userId}`, {
    method: 'PATCH',
    body:   JSON.stringify(updates),
  })
}

export async function addStudentCourse(userId, courseId) {
  return authFetch(`/api/admin/students/${userId}/courses`, {
    method: 'POST',
    body:   JSON.stringify({ courseId }),
  })
}

export async function removeStudentCourse(userId, courseId) {
  return authFetch(`/api/admin/students/${userId}/courses/${courseId}`, {
    method: 'DELETE',
  })
}

// action: 'grant' | 'extend' | 'suspend' | 'change_tier'
export async function manageStudentSubscription(userId, action, options = {}) {
  return authFetch(`/api/admin/students/${userId}/subscription`, {
    method: 'PATCH',
    body:   JSON.stringify({ action, ...options }),
  })
}

export async function adminDeleteStudent(userId) {
  return authFetch(`/api/admin/students/${userId}`, {
    method: 'DELETE',
  })
}
