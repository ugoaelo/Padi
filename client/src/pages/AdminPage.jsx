import { useState, useEffect, useRef } from 'react'
import {
  getAdminStats, getAdminUsers, getAdminWaitlist,
  getFlaggedAnswers, reviewFlag, batchUpload,
  getKnowledgeBase, deleteKbDoc, setUserAdmin,
} from '../lib/aiApi.js'
import {
  getAdminSchools,
  uploadTQFile,
  patchQuestion,
  publishQuestions,
  uploadQuestionImage,
  createSchool,
  createDepartment,
  getAdminStudents,
  getAdminStudent,
  updateAdminStudent,
  addStudentCourse,
  removeStudentCourse,
  manageStudentSubscription,
  adminDeleteStudent,
  searchCourses,
} from '../lib/contentApi.js'
import { useAuth } from '../context/AuthContext'
import './AdminPage.css'

export default function AdminPage() {
  const { user } = useAuth()
  const [tab,       setTab]       = useState('overview')
  const [stats,     setStats]     = useState(null)
  const [users,     setUsers]     = useState([])
  const [waitlist,  setWaitlist]  = useState([])
  const [flagged,   setFlagged]   = useState([])
  const [knowledgeBase, setKnowledgeBase] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [kbSubject,    setKbSubject]    = useState('')
  const [kbLevel,      setKbLevel]      = useState('')  // e.g. '100', '200', '' = all levels
  const fileRef         = useRef(null)
  const imageUploadRef  = useRef(null)
  const [uploadingImageId, setUploadingImageId] = useState(null)

  // ── Content tab state ─────────────────────────────────────────
  const [schools,          setSchools]          = useState([])
  const [selectedSchool,   setSelectedSchool]   = useState(null)
  const [selectedDept,     setSelectedDept]     = useState(null)
  const [selectedCourse,   setSelectedCourse]   = useState(null)
  const [draftQuestions,   setDraftQuestions]   = useState([])
  const [tqUploading,      setTqUploading]      = useState(false)
  const [tqUploadMsg,      setTqUploadMsg]      = useState('')
  const [tqDuplicateInfo,  setTqDuplicateInfo]  = useState(null)  // { existingCount, publishedCount, draftCount, pendingFile }

  const [publishing,       setPublishing]       = useState(false)
  const [publishMsg,       setPublishMsg]       = useState('')
  const [editingId,        setEditingId]        = useState(null)
  const [editDraft,        setEditDraft]        = useState({})
  const [selectedQIds,     setSelectedQIds]     = useState(new Set())
  const [showNewSchool,    setShowNewSchool]    = useState(false)
  const [showNewDept,      setShowNewDept]      = useState(false)
  const [newSchoolForm,    setNewSchoolForm]    = useState({ name:'', slug:'', short_name:'', state:'' })
  const [newDeptForm,      setNewDeptForm]      = useState({ name:'', slug:'', faculty:'' })
  const [schoolFormMsg,    setSchoolFormMsg]    = useState('')
  const tqFileRef = useRef(null)

  // ── Students tab state ────────────────────────────────────────
  const [students,         setStudents]         = useState([])
  const [studentsLoading,  setStudentsLoading]  = useState(false)
  const [studentFilters,   setStudentFilters]   = useState({ search: '', level: '', deleted: '' })
  const [selectedStudent,  setSelectedStudent]  = useState(null)  // full detail modal
  const [studentDetail,    setStudentDetail]    = useState(null)  // { student, courses, subscription }
  const [studentDetailLoading, setStudentDetailLoading] = useState(false)
  const [studentEditForm,  setStudentEditForm]  = useState({})
  const [studentEditSaving, setStudentEditSaving] = useState(false)
  const [studentEditMsg,   setStudentEditMsg]   = useState('')
  const [studentCourseSearch, setStudentCourseSearch] = useState('')
  const [studentCourseResults, setStudentCourseResults] = useState([])
  const [studentSubMsg,    setStudentSubMsg]    = useState('')

  useEffect(() => { loadStats() }, [])
  useEffect(() => {
    if (tab === 'users')     loadUsers()
    if (tab === 'waitlist')  loadWaitlist()
    if (tab === 'flagged')   loadFlagged()
    if (tab === 'knowledge') loadKnowledgeBase()
    if (tab === 'content')   loadSchools()
    if (tab === 'students')  loadStudents()
  }, [tab])

  const loadStats     = async () => { try { const d = await getAdminStats(); setStats(d) } catch(e){ setLoadError(e.message || 'Could not connect to server.') } finally{setLoading(false)} }
  const loadUsers     = async () => { try { const d = await getAdminUsers(); setUsers(d.users) } catch(e){} }
  const loadWaitlist  = async () => { try { const d = await getAdminWaitlist(); setWaitlist(d.waitlist) } catch(e){} }
  const loadFlagged   = async () => { try { const d = await getFlaggedAnswers(); setFlagged(d.flagged) } catch(e){} }
  const loadKnowledgeBase = async () => { try { const d = await getKnowledgeBase(); setKnowledgeBase(d.documents) } catch(e){} }

  const loadStudents = async (filters = studentFilters) => {
    setStudentsLoading(true)
    try {
      const d = await getAdminStudents(filters)
      setStudents(d.students || [])
    } catch(e) { console.error('Failed to load students', e) }
    finally { setStudentsLoading(false) }
  }

  const openStudentDetail = async (student) => {
    setSelectedStudent(student)
    setStudentEditForm({
      first_name:    student.first_name || '',
      last_name:     student.last_name  || '',
      preferred_name: student.preferred_name || '',
      level:         student.level || '',
      summer_semester: student.summer_semester || false,
      whatsapp:      student.whatsapp || '',
    })
    setStudentEditMsg('')
    setStudentSubMsg('')
    setStudentDetailLoading(true)
    try {
      const d = await getAdminStudent(student.id)
      setStudentDetail(d)
    } catch(e) { setStudentDetail(null) }
    finally { setStudentDetailLoading(false) }
  }

  const saveStudentEdit = async () => {
    if (!selectedStudent) return
    setStudentEditSaving(true)
    setStudentEditMsg('')
    try {
      await updateAdminStudent(selectedStudent.id, studentEditForm)
      setStudentEditMsg('✓ Saved')
      // Refresh list
      loadStudents()
    } catch(e) { setStudentEditMsg(e.message || 'Failed to save.') }
    finally { setStudentEditSaving(false) }
  }

  const handleAddStudentCourse = async (course) => {
    if (!selectedStudent) return
    try {
      await addStudentCourse(selectedStudent.id, course.id)
      const d = await getAdminStudent(selectedStudent.id)
      setStudentDetail(d)
      setStudentCourseSearch('')
      setStudentCourseResults([])
    } catch(e) { setStudentEditMsg(e.message || 'Failed to add course.') }
  }

  const handleRemoveStudentCourse = async (courseId) => {
    if (!selectedStudent) return
    try {
      await removeStudentCourse(selectedStudent.id, courseId)
      const d = await getAdminStudent(selectedStudent.id)
      setStudentDetail(d)
    } catch(e) { setStudentEditMsg(e.message || 'Failed to remove course.') }
  }

  const handleStudentSubAction = async (action, options = {}) => {
    if (!selectedStudent) return
    setStudentSubMsg('')
    try {
      await manageStudentSubscription(selectedStudent.id, action, options)
      setStudentSubMsg(`✓ ${action} applied`)
      const d = await getAdminStudent(selectedStudent.id)
      setStudentDetail(d)
    } catch(e) { setStudentSubMsg(e.message || 'Failed.') }
  }

  const handleAdminDeleteStudent = async () => {
    if (!selectedStudent) return
    if (!window.confirm(`Delete ${selectedStudent.first_name || selectedStudent.full_name}'s account? This schedules deletion in 30 days.`)) return
    try {
      await adminDeleteStudent(selectedStudent.id)
      setSelectedStudent(null)
      setStudentDetail(null)
      loadStudents()
    } catch(e) { setStudentEditMsg(e.message || 'Failed to delete.') }
  }

  const handleStudentCourseSearch = async (q) => {
    setStudentCourseSearch(q)
    if (q.length < 2) { setStudentCourseResults([]); return }
    try {
      const d = await searchCourses(q)
      setStudentCourseResults(d.courses || [])
    } catch {}
  }

  const handleReviewFlag = async (id) => {
    try {
      await reviewFlag(id)
      setFlagged(prev => prev.filter(f => f.id !== id))
    } catch(e) { console.error(e) }
  }

  const handleToggleAdmin = async (userId, currentlyAdmin) => {
    const action = currentlyAdmin ? 'remove admin access from' : 'grant admin access to'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return
    try {
      await setUserAdmin(userId, !currentlyAdmin)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentlyAdmin } : u))
    } catch(e) { alert(e.message) }
  }

  const loadSchools = async () => {
    try { const d = await getAdminSchools(); setSchools(d.schools || []) } catch(e) {}
  }

  // ── TQ upload handlers ────────────────────────────────────────
  const runTqUpload = async (file, mode = 'check') => {
    setTqUploading(true)
    setTqUploadMsg('')
    setDraftQuestions([])
    setSelectedQIds(new Set())
    setTqDuplicateInfo(null)
    try {
      const result = await uploadTQFile({
        courseId: selectedCourse.id,
        schoolId: selectedSchool.id,
        file,
        mode,
      })
      setDraftQuestions(result.questions || [])
      setSelectedQIds(new Set((result.questions || []).map(q => q.id)))
      setTqUploadMsg(`✓ ${result.questions?.length || 0} questions parsed. Review below, then publish.`)
    } catch(err) {
      if (err.code === 'QUESTIONS_EXIST') {
        // Pause and ask admin: augment or replace?
        setTqDuplicateInfo({
          existingCount:  err.existingCount,
          publishedCount: err.publishedCount,
          draftCount:     err.draftCount,
          pendingFile:    file,
        })
      } else {
        setTqUploadMsg(`✗ ${err.message}`)
      }
    } finally {
      setTqUploading(false)
    }
  }

  const handleTqFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedCourse || !selectedSchool) return
    e.target.value = ''
    await runTqUpload(file, 'check')
  }

  const handleTqDuplicateChoice = async (mode) => {
    if (!tqDuplicateInfo?.pendingFile) return
    await runTqUpload(tqDuplicateInfo.pendingFile, mode)
  }

  const handleQuestionImageUpload = async (questionId, e) => {
    const file = e.target.files?.[0]
    if (!file || !questionId) return
    e.target.value = ''
    setUploadingImageId(questionId)
    try {
      const { imageUrl } = await uploadQuestionImage(questionId, file)
      // Update local draft state so the thumbnail shows immediately
      setDraftQuestions(prev => prev.map(q =>
        q.id === questionId ? { ...q, question_image_url: imageUrl } : q
      ))
    } catch(err) {
      setTqUploadMsg(`✗ Image upload failed: ${err.message}`)
    } finally {
      setUploadingImageId(null)
    }
  }

  const handleEditQuestion = (q) => {
    setEditingId(q.id)
    setEditDraft({ question_text: q.question_text, topic: q.topic || '' })
  }

  const handleSaveEdit = async (qId) => {
    try {
      const updated = await patchQuestion(qId, editDraft)
      setDraftQuestions(prev => prev.map(q => q.id === qId ? { ...q, ...updated } : q))
      setEditingId(null)
    } catch(err) {
      alert(err.message)
    }
  }

  const handlePublish = async () => {
    if (selectedQIds.size === 0) return
    if (!confirm(`Publish ${selectedQIds.size} question(s)? This makes them visible to students.`)) return
    setPublishing(true)
    setPublishMsg('')
    try {
      const result = await publishQuestions([...selectedQIds])
      setPublishMsg(`✓ ${result.published} question(s) published successfully.`)
      setDraftQuestions(prev => prev.filter(q => !selectedQIds.has(q.id)))
      setSelectedQIds(new Set())
    } catch(err) {
      setPublishMsg(`✗ ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  const handleCreateSchool = async (e) => {
    e.preventDefault()
    try {
      const d = await createSchool(newSchoolForm)
      setSchools(prev => [...prev, d.school])
      setNewSchoolForm({ name:'', slug:'', short_name:'', state:'' })
      setShowNewSchool(false)
      setSchoolFormMsg('School created.')
    } catch(err) { setSchoolFormMsg(err.message) }
  }

  const handleCreateDept = async (e) => {
    e.preventDefault()
    if (!selectedSchool) return
    try {
      const d = await createDepartment(selectedSchool.id, newDeptForm)
      setSchools(prev => prev.map(s =>
        s.id === selectedSchool.id
          ? { ...s, departments: [...(s.departments || []), d.department] }
          : s
      ))
      setSelectedSchool(prev => ({ ...prev, departments: [...(prev.departments || []), d.department] }))
      setNewDeptForm({ name:'', slug:'', faculty:'' })
      setShowNewDept(false)
      setSchoolFormMsg('Department created.')
    } catch(err) { setSchoolFormMsg(err.message) }
  }

  const handleDeleteKb = async (id) => {
    if (!confirm('Delete this document from the knowledge base?')) return
    try {
      await deleteKbDoc(id)
      setKnowledgeBase(prev => prev.filter(d => d.id !== id))
    } catch(e) { console.error(e) }
  }

  const handleBatchUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    setUploadResult(null)

    const documents = []
    for (const file of files) {
      const content = await file.text()
      documents.push({
        title:   file.name.replace(/\.[^/.]+$/, ''),
        content,
        subject: kbSubject.trim() || null,
        level:   kbLevel   || null,
        type:    'document',
      })
    }

    try {
      const result = await batchUpload({ documents })
      setUploadResult(result)
      loadKnowledgeBase()
    } catch(e) {
      setUploadResult({ error: e.message })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const TABS = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'content',   label: '📖 TQ Content' },
    { id: 'students',  label: '🎓 Students' },
    { id: 'users',     label: '👥 Users' },
    { id: 'waitlist',  label: '📋 Waitlist' },
    { id: 'flagged',   label: `🚩 Flagged ${stats?.pendingFlags ? `(${stats.pendingFlags})` : ''}` },
    { id: 'knowledge', label: '📚 Knowledge Base' },
  ]

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Super Admin</h1>
        <p className="admin-sub">Manage Padi — users, content, flags, and the knowledge base.</p>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`admin-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="admin-overview">
          {loading ? (
            <div className="admin-loading">
              <div className="admin-spinner" />
              <span>Loading stats...</span>
            </div>
          ) : loadError ? (
            <div className="admin-error-state">
              <div style={{fontSize:32}}>⚠️</div>
              <p style={{fontWeight:600, color:'var(--ink)', margin:'8px 0 4px'}}>Couldn't load stats</p>
              <p style={{fontSize:13, color:'var(--ink-soft)', marginBottom:16}}>{loadError}</p>
              <button className="btn btn-brand" onClick={() => { setLoading(true); setLoadError(''); loadStats() }}>Retry</button>
            </div>
          ) : (
            <div className="admin-stats-grid">
              {[
                { label: 'Total users',         value: stats?.totalUsers,        icon: '👥' },
                { label: 'Active subscribers',  value: stats?.activeSubscribers, icon: '💳' },
                { label: 'Founding members',    value: stats?.foundingMembers,   icon: '⭐' },
                { label: 'Waitlist signups',    value: stats?.waitlistSignups,   icon: '📋' },
                { label: 'Flagged answers',     value: stats?.pendingFlags,      icon: '🚩' },
                { label: 'Cached AI responses', value: stats?.cachedResponses,   icon: '⚡' },
              ].map(s => (
                <div key={s.label} className="admin-stat-card">
                  <div className="admin-stat-icon">{s.icon}</div>
                  <div className="admin-stat-value">{s.value ?? '—'}</div>
                  <div className="admin-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="admin-table-section">
          <div className="admin-table-header">
            <span>{users.length} users</span>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span><span>University</span><span>Course</span><span>Status</span><span>Joined</span><span>Admin</span>
            </div>
            {users.map(u => (
              <div key={u.id} className="admin-table-row">
                <span className="admin-cell-name">
                  {u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || 'No name'}
                  {u.founding_member && <span className="admin-founding-tag">⭐</span>}
                </span>
                <span className="admin-cell-muted">{u.university || '—'}</span>
                <span className="admin-cell-muted">{u.course || '—'}</span>
                <span>
                  <span className={`admin-status-badge ${u.subscriptions?.[0]?.status === 'active' ? 'active' : 'inactive'}`}>
                    {u.subscriptions?.[0]?.status || 'No sub'}
                  </span>
                </span>
                <span className="admin-cell-muted">{new Date(u.created_at).toLocaleDateString()}</span>
                <span>
                  {u.id === user?.id
                    ? <span className="admin-founding-tag" title="You">🔑 You</span>
                    : (
                      <button
                        className={`admin-status-badge ${u.is_admin ? 'active' : 'inactive'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                        title={u.is_admin ? 'Click to revoke admin' : 'Click to grant admin'}
                      >
                        {u.is_admin ? '✓ Admin' : '+ Grant'}
                      </button>
                    )
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WAITLIST */}
      {tab === 'waitlist' && (
        <div className="admin-table-section">
          <div className="admin-table-header">
            <span>{waitlist.length} signups</span>
            <button className="admin-export-btn" onClick={() => {
              const csv = ['Name,Email,University,Course,WhatsApp,Date',
                ...waitlist.map(w => `"${w.full_name}","${w.email}","${w.university||''}","${w.course||''}","${w.whatsapp||''}","${new Date(w.created_at).toLocaleDateString()}"`)
              ].join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'padi-waitlist.csv'; a.click()
            }}>
              ⬇ Export CSV
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Name</span><span>Email</span><span>University</span><span>Course</span><span>Date</span>
            </div>
            {waitlist.map(w => (
              <div key={w.id} className="admin-table-row">
                <span className="admin-cell-name">{w.full_name}</span>
                <span className="admin-cell-muted">{w.email}</span>
                <span className="admin-cell-muted">{w.university || '—'}</span>
                <span className="admin-cell-muted">{w.course || '—'}</span>
                <span className="admin-cell-muted">{new Date(w.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLAGGED */}
      {tab === 'flagged' && (
        <div className="admin-flagged">
          {flagged.length === 0 ? (
            <div className="admin-empty">✅ No unreviewed flagged answers.</div>
          ) : flagged.map(f => (
            <div key={f.id} className="admin-flag-card">
              <div className="admin-flag-meta">
                <span className="admin-flag-user">{f.profiles?.full_name || 'Anonymous'}</span>
                <span className="admin-flag-date">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              {f.question && (
                <div className="admin-flag-section">
                  <div className="admin-flag-label">Question</div>
                  <div className="admin-flag-text">{f.question}</div>
                </div>
              )}
              {f.answer && (
                <div className="admin-flag-section">
                  <div className="admin-flag-label">AI Answer (flagged)</div>
                  <div className="admin-flag-text admin-flag-answer">{f.answer.substring(0, 300)}...</div>
                </div>
              )}
              <div className="admin-flag-section">
                <div className="admin-flag-label">Reason</div>
                <div className="admin-flag-reason">{f.reason}</div>
              </div>
              <button className="admin-review-btn" onClick={() => handleReviewFlag(f.id)}>
                ✓ Mark as reviewed
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── TQ CONTENT ─────────────────────────────────────────── */}
      {tab === 'content' && (
        <div className="admin-content-tab">

          {/* School / Dept / Course selector */}
          <div className="admin-content-selectors">
            <div className="admin-selector-group">
              <label className="admin-selector-label">School</label>
              <select className="admin-selector-select"
                value={selectedSchool?.id || ''}
                onChange={e => {
                  const s = schools.find(x => x.id === e.target.value) || null
                  setSelectedSchool(s)
                  setSelectedDept(null)
                  setSelectedCourse(null)
                  setDraftQuestions([])
                }}>
                <option value="">Select school…</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {selectedSchool && (
              <div className="admin-selector-group">
                <label className="admin-selector-label">Department</label>
                <select className="admin-selector-select"
                  value={selectedDept?.id || ''}
                  onChange={e => {
                    const d = (selectedSchool.departments || []).find(x => x.id === e.target.value) || null
                    setSelectedDept(d)
                    setSelectedCourse(null)
                    setDraftQuestions([])
                  }}>
                  <option value="">Select department…</option>
                  {(selectedSchool.departments || []).map(d =>
                    <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {selectedDept && (
              <div className="admin-selector-group">
                <label className="admin-selector-label">Course</label>
                <select className="admin-selector-select"
                  value={selectedCourse?.id || ''}
                  onChange={e => {
                    const courses = selectedDept.courses || []
                    const c = courses.find(x => x.id === e.target.value) || null
                    setSelectedCourse(c)
                    setDraftQuestions([])
                  }}>
                  <option value="">Select course…</option>
                  {(selectedDept.courses || []).map(c =>
                    <option key={c.id} value={c.id}>{c.course_code} — {c.course_title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* New school form */}
          <div className="admin-content-meta-actions">
            <button className="admin-meta-btn" onClick={() => { setShowNewSchool(s => !s); setShowNewDept(false) }}>
              {showNewSchool ? '✕ Cancel' : '＋ New School'}
            </button>
            {selectedSchool && (
              <button className="admin-meta-btn" onClick={() => { setShowNewDept(s => !s); setShowNewSchool(false) }}>
                {showNewDept ? '✕ Cancel' : '＋ New Department'}
              </button>
            )}
          </div>

          {schoolFormMsg && <div className="admin-form-msg">{schoolFormMsg}</div>}

          {showNewSchool && (
            <form className="admin-inline-form" onSubmit={handleCreateSchool}>
              <h3>New School</h3>
              <div className="admin-form-row">
                <input placeholder="Full name" required value={newSchoolForm.name}
                  onChange={e => setNewSchoolForm(p => ({ ...p, name: e.target.value }))} />
                <input placeholder="slug (e.g. lead-city)" required value={newSchoolForm.slug}
                  onChange={e => setNewSchoolForm(p => ({ ...p, slug: e.target.value }))} />
                <input placeholder="Short name (e.g. LCU)" value={newSchoolForm.short_name}
                  onChange={e => setNewSchoolForm(p => ({ ...p, short_name: e.target.value }))} />
                <input placeholder="State (e.g. Oyo)" value={newSchoolForm.state}
                  onChange={e => setNewSchoolForm(p => ({ ...p, state: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-brand">Create School</button>
            </form>
          )}

          {showNewDept && selectedSchool && (
            <form className="admin-inline-form" onSubmit={handleCreateDept}>
              <h3>New Department in {selectedSchool.name}</h3>
              <div className="admin-form-row">
                <input placeholder="Department name" required value={newDeptForm.name}
                  onChange={e => setNewDeptForm(p => ({ ...p, name: e.target.value }))} />
                <input placeholder="slug (e.g. computing)" required value={newDeptForm.slug}
                  onChange={e => setNewDeptForm(p => ({ ...p, slug: e.target.value }))} />
                <input placeholder="Faculty (e.g. Sciences)" value={newDeptForm.faculty}
                  onChange={e => setNewDeptForm(p => ({ ...p, faculty: e.target.value }))} />
              </div>
              <button type="submit" className="btn btn-brand">Create Department</button>
            </form>
          )}

          {/* TQ file upload */}
          {selectedCourse && (
            <div className="admin-tq-upload-box">
              <input type="file" ref={tqFileRef} accept=".pdf,.docx,.doc,.txt"
                onChange={handleTqFileUpload} style={{ display: 'none' }} />
              <div className="admin-tq-upload-info">
                <strong>{selectedCourse.course_code}</strong> — {selectedCourse.course_title}
              </div>
              <button
                className="btn btn-brand"
                onClick={() => tqFileRef.current?.click()}
                disabled={tqUploading}>
                {tqUploading ? '⏳ Parsing…' : '📤 Upload TQ file (PDF / DOCX / TXT)'}
              </button>
              {tqUploadMsg && (
                <div className={`admin-tq-msg ${tqUploadMsg.startsWith('✓') ? 'ok' : 'err'}`}>
                  {tqUploadMsg}
                </div>
              )}

              {/* Duplicate conflict prompt */}
              {tqDuplicateInfo && (
                <div className="admin-tq-duplicate-warning">
                  <p>
                    <strong>⚠ Questions already exist for {selectedCourse.course_code}:</strong>{' '}
                    {tqDuplicateInfo.publishedCount} published, {tqDuplicateInfo.draftCount} draft
                    ({tqDuplicateInfo.existingCount} total).
                  </p>
                  <p>How do you want to handle the new upload?</p>
                  <div className="admin-tq-duplicate-actions">
                    <button className="btn btn-brand" disabled={tqUploading}
                      onClick={() => handleTqDuplicateChoice('augment')}>
                      ➕ Add alongside existing
                    </button>
                    <button className="btn" style={{ background: '#FEE2E2', color: '#991B1B', border: 'none' }}
                      disabled={tqUploading}
                      onClick={() => handleTqDuplicateChoice('replace')}>
                      🗑 Replace drafts &amp; re-parse
                    </button>
                    <button className="btn" style={{ background: 'none', border: 'none', color: 'var(--ink-light)' }}
                      onClick={() => setTqDuplicateInfo(null)}>
                      Cancel
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
                    "Replace" deletes existing <em>drafts</em> only — published questions are not affected.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Draft question list */}
          {draftQuestions.length > 0 && (
            <div className="admin-draft-section">
              <div className="admin-draft-toolbar">
                <span className="admin-draft-count">{draftQuestions.length} draft questions</span>
                <label className="admin-select-all">
                  <input type="checkbox"
                    checked={selectedQIds.size === draftQuestions.length}
                    onChange={e => {
                      if (e.target.checked) setSelectedQIds(new Set(draftQuestions.map(q => q.id)))
                      else setSelectedQIds(new Set())
                    }} />
                  Select all
                </label>
                <button
                  className="btn btn-brand"
                  disabled={selectedQIds.size === 0 || publishing}
                  onClick={handlePublish}>
                  {publishing ? 'Publishing…' : `Publish ${selectedQIds.size} selected`}
                </button>
              </div>
              {publishMsg && (
                <div className={`admin-tq-msg ${publishMsg.startsWith('✓') ? 'ok' : 'err'}`}>
                  {publishMsg}
                </div>
              )}
              <div className="admin-draft-list">
                {draftQuestions.map((q, i) => (
                  <div key={q.id} className={`admin-draft-item ${selectedQIds.has(q.id) ? 'selected' : ''}`}>
                    <label className="admin-draft-check">
                      <input type="checkbox"
                        checked={selectedQIds.has(q.id)}
                        onChange={e => {
                          setSelectedQIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(q.id)
                            else next.delete(q.id)
                            return next
                          })
                        }} />
                    </label>
                    <div className="admin-draft-num">Q{q.question_number || i + 1}</div>
                    <div className="admin-draft-body">
                      {editingId === q.id ? (
                        <>
                          <textarea className="admin-draft-edit-text"
                            value={editDraft.question_text}
                            onChange={e => setEditDraft(p => ({ ...p, question_text: e.target.value }))}
                            rows={4} />
                          <input className="admin-draft-edit-topic"
                            placeholder="Topic"
                            value={editDraft.topic}
                            onChange={e => setEditDraft(p => ({ ...p, topic: e.target.value }))} />
                          <div className="admin-draft-edit-actions">
                            <button className="admin-draft-save" onClick={() => handleSaveEdit(q.id)}>Save</button>
                            <button className="admin-draft-cancel" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="admin-draft-text">{q.question_text}</div>
                          {q.topic && <div className="admin-draft-topic">{q.topic}</div>}
                        </>
                      )}
                    </div>
                    {editingId !== q.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        <button className="admin-draft-edit-btn"
                          onClick={() => handleEditQuestion(q)}
                          title="Edit question">✏️</button>
                        {/* Per-question image upload */}
                        <label title="Upload image for this question"
                          style={{ cursor: 'pointer', fontSize: 16, opacity: uploadingImageId === q.id ? 0.4 : 1 }}>
                          {uploadingImageId === q.id ? '⏳' : (q.question_image_url ? '🖼️' : '📷')}
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => handleQuestionImageUpload(q.id, e)} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* KNOWLEDGE BASE */}
      {tab === 'knowledge' && (
        <div className="admin-knowledge">
          <div className="admin-kb-upload">
            <p className="admin-kb-hint" style={{ marginBottom: 12 }}>
              Upload textbooks, notes, or reference material to enrich Padi's knowledge base for <strong>all students</strong>.
              Tag by subject and level to make context injection more targeted.
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Subject / discipline (e.g. Biochemistry)"
                value={kbSubject}
                onChange={e => setKbSubject(e.target.value)}
                style={{ flex: 2, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              />
              <select
                value={kbLevel}
                onChange={e => setKbLevel(e.target.value)}
                style={{ flex: 1, minWidth: 130, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              >
                <option value="">All levels</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
                <option value="600">600 Level</option>
              </select>
            </div>
            <input type="file" ref={fileRef} multiple accept=".txt,.pdf,.doc,.docx"
              onChange={handleBatchUpload} style={{display:'none'}} />
            <button
              className="btn btn-brand"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ Uploading...' : '📤 Batch upload documents'}
            </button>
          </div>

          {uploadResult && (
            <div className={`admin-upload-result ${uploadResult.error ? 'error' : 'success'}`}>
              {uploadResult.error
                ? `Error: ${uploadResult.error}`
                : `✅ Processed ${uploadResult.processed} documents. ${uploadResult.results?.filter(r=>r.success).length} succeeded.`}
            </div>
          )}

          <div className="admin-kb-list">
            <div className="admin-table-header">
              <span>{knowledgeBase.length} documents in knowledge base</span>
            </div>
            {knowledgeBase.length === 0 ? (
              <div className="admin-empty">No documents uploaded yet.</div>
            ) : knowledgeBase.map(doc => (
              <div key={doc.id} className="admin-kb-item">
                <div className="admin-kb-info">
                  <div className="admin-kb-title">{doc.title}</div>
                  <div className="admin-kb-meta">
                    {doc.subject && <span className="admin-kb-subject">{doc.subject}</span>}
                    {doc.level   && <span className="admin-kb-subject" style={{ background: '#EEF2FF', color: '#4338CA' }}>{doc.level}L</span>}
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button className="admin-delete-btn" onClick={() => handleDeleteKb(doc.id)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STUDENTS ──────────────────────────────────────────── */}
      {tab === 'students' && (
        <div className="admin-students">

          {/* Filter bar */}
          <div className="admin-student-filters">
            <input
              className="admin-input"
              type="text"
              placeholder="Search name or email…"
              value={studentFilters.search}
              onChange={e => { const f = {...studentFilters, search: e.target.value}; setStudentFilters(f); loadStudents(f) }}
            />
            <select
              className="admin-input"
              value={studentFilters.level}
              onChange={e => { const f = {...studentFilters, level: e.target.value}; setStudentFilters(f); loadStudents(f) }}>
              <option value="">All levels</option>
              {['100','200','300','400','500','600'].map(l => <option key={l} value={l}>{l}L</option>)}
            </select>
            <select
              className="admin-input"
              value={studentFilters.deleted}
              onChange={e => { const f = {...studentFilters, deleted: e.target.value}; setStudentFilters(f); loadStudents(f) }}>
              <option value="">Active accounts</option>
              <option value="true">Deleted accounts</option>
            </select>
            <button className="btn btn-brand" style={{ whiteSpace: 'nowrap' }} onClick={() => loadStudents(studentFilters)}>
              🔄 Refresh
            </button>
          </div>

          {studentsLoading ? (
            <div className="admin-loading"><div className="admin-spinner" /><span>Loading students…</span></div>
          ) : (
            <div className="admin-student-table">
              <div className="admin-table-header">
                <span>{students.length} student{students.length !== 1 ? 's' : ''}</span>
              </div>
              {students.length === 0 ? (
                <div className="admin-empty">No students found.</div>
              ) : students.map(s => {
                const sub = Array.isArray(s.subscriptions) ? s.subscriptions[0] : s.subscriptions
                return (
                  <div key={s.id} className="admin-student-row" onClick={() => openStudentDetail(s)}>
                    <div className="admin-student-info">
                      <div className="admin-student-name">
                        {s.first_name} {s.last_name}
                        {s.preferred_name && <span className="admin-student-pref"> ({s.preferred_name})</span>}
                        {s.founding_member && <span className="admin-badge-founding">⭐ Founding</span>}
                        {s.summer_semester && <span className="admin-badge-summer">☀️ Summer</span>}
                        {s.deleted_at && <span className="admin-badge-deleted">🗑 Deleted</span>}
                      </div>
                      <div className="admin-student-meta">
                        {s.email} · {s.university || '—'} · Level {s.level || '—'}
                      </div>
                    </div>
                    <div className="admin-student-sub">
                      <span className={`admin-sub-badge ${sub?.status === 'active' ? 'active' : 'inactive'}`}>
                        {sub?.status || 'no sub'}{sub?.plan_type ? ` · ${sub.plan_type}` : ''}
                      </span>
                    </div>
                    <span className="admin-student-arrow">→</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Student detail modal */}
          {selectedStudent && (
            <div className="admin-modal-backdrop" onClick={() => { setSelectedStudent(null); setStudentDetail(null) }}>
              <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <div className="admin-modal-header">
                  <h2 className="admin-modal-title">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h2>
                  <button className="admin-modal-close" onClick={() => { setSelectedStudent(null); setStudentDetail(null) }}>✕</button>
                </div>

                {studentDetailLoading ? (
                  <div className="admin-loading" style={{ padding: '40px 0' }}><div className="admin-spinner" /></div>
                ) : (
                  <>
                    {/* Profile edit */}
                    <div className="admin-modal-section">
                      <div className="admin-modal-section-title">Profile</div>
                      <div className="admin-modal-grid">
                        {[
                          ['first_name', 'First name'],
                          ['last_name',  'Last name'],
                          ['preferred_name', 'Preferred name'],
                          ['level', 'Level'],
                          ['whatsapp', 'WhatsApp'],
                        ].map(([key, label]) => (
                          <div key={key} className="admin-modal-field">
                            <label className="admin-modal-label">{label}</label>
                            <input
                              className="admin-input"
                              value={studentEditForm[key] || ''}
                              onChange={e => setStudentEditForm(p => ({...p, [key]: e.target.value}))}
                            />
                          </div>
                        ))}
                        <div className="admin-modal-field">
                          <label className="admin-modal-label">
                            <input
                              type="checkbox"
                              checked={studentEditForm.summer_semester || false}
                              onChange={e => setStudentEditForm(p => ({...p, summer_semester: e.target.checked}))}
                              style={{ marginRight: 6 }}
                            />
                            Summer semester student
                          </label>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="btn btn-brand" onClick={saveStudentEdit} disabled={studentEditSaving}>
                          {studentEditSaving ? 'Saving…' : 'Save profile'}
                        </button>
                        {studentEditMsg && (
                          <span style={{ fontSize: 13, color: studentEditMsg.startsWith('✓') ? '#10B981' : '#EF4444', alignSelf: 'center' }}>
                            {studentEditMsg}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Courses */}
                    <div className="admin-modal-section">
                      <div className="admin-modal-section-title">Enrolled courses ({studentDetail?.courses?.length || 0})</div>
                      <div className="admin-modal-courses">
                        {(studentDetail?.courses || []).map(uc => (
                          <div key={uc.course_id} className="admin-modal-course-item">
                            <span className="admin-course-code">{uc.courses?.course_code}</span>
                            <span className="admin-course-title">{uc.courses?.course_title}</span>
                            <button className="admin-remove-btn" onClick={() => handleRemoveStudentCourse(uc.course_id)} title="Remove course">×</button>
                          </div>
                        ))}
                        {(studentDetail?.courses || []).length === 0 && <p style={{fontSize:13,color:'#71717A'}}>No courses enrolled.</p>}
                      </div>
                      <div className="admin-course-add-row">
                        <input
                          className="admin-input"
                          placeholder="Search course to add…"
                          value={studentCourseSearch}
                          onChange={e => handleStudentCourseSearch(e.target.value)}
                        />
                      </div>
                      {studentCourseResults.length > 0 && (
                        <div className="admin-course-search-results">
                          {studentCourseResults.slice(0, 6).map(c => (
                            <button key={c.id} className="admin-course-result" onClick={() => handleAddStudentCourse(c)}>
                              <strong>{c.course_code}</strong> {c.course_title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subscription */}
                    <div className="admin-modal-section">
                      <div className="admin-modal-section-title">Subscription</div>
                      {studentDetail?.subscription ? (
                        <div style={{ fontSize: 13, color: '#A1A1AA', marginBottom: 10 }}>
                          Status: <strong style={{color:'#E4E4F0'}}>{studentDetail.subscription.status}</strong> ·
                          Plan: <strong style={{color:'#E4E4F0'}}>{studentDetail.subscription.plan_type || '—'}</strong> ·
                          Expires: <strong style={{color:'#E4E4F0'}}>{studentDetail.subscription.current_period_end ? new Date(studentDetail.subscription.current_period_end).toLocaleDateString() : '—'}</strong>
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: '#71717A', marginBottom: 10 }}>No active subscription.</p>
                      )}
                      <div className="admin-sub-actions">
                        <button className="btn" style={{background:'#10B981',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('grant', { tier: 'base', days: 30 })}>Grant 30d (Base)</button>
                        <button className="btn" style={{background:'#4F46E5',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('grant', { tier: 'premium', days: 30 })}>Grant 30d (Premium)</button>
                        <button className="btn" style={{background:'#F59E0B',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('extend', { days: 30 })}>Extend +30d</button>
                        <button className="btn" style={{background:'#374151',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('suspend')}>Suspend</button>
                        <button className="btn" style={{background:'#7C3AED',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('change_tier', { tier: studentDetail?.subscription?.plan_type === 'premium' ? 'base' : 'premium' })}>
                          Switch to {studentDetail?.subscription?.plan_type === 'premium' ? 'Base' : 'Premium'}
                        </button>
                        {studentDetail?.subscription?.paused_until && new Date(studentDetail.subscription.paused_until) > new Date() ? (
                          <button className="btn" style={{background:'#0EA5E9',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('resume')}>
                            ▶ Resume (paused until {new Date(studentDetail.subscription.paused_until).toLocaleDateString('en-GB',{day:'numeric',month:'short'})})
                          </button>
                        ) : (
                          <button className="btn" style={{background:'#64748B',color:'white',fontSize:13}} onClick={() => handleStudentSubAction('pause', { months: 1 })}>⏸ Pause 1 month</button>
                        )}
                      </div>
                      {studentSubMsg && (
                        <p style={{ fontSize: 13, marginTop: 8, color: studentSubMsg.startsWith('✓') ? '#10B981' : '#EF4444' }}>{studentSubMsg}</p>
                      )}
                    </div>

                    {/* Danger zone */}
                    <div className="admin-modal-section admin-modal-danger">
                      <div className="admin-modal-section-title">Danger zone</div>
                      <button className="btn" style={{background:'#DC2626',color:'white',fontSize:13}} onClick={handleAdminDeleteStudent}>
                        Schedule account deletion
                      </button>
                      <p style={{ fontSize: 12, color: '#71717A', marginTop: 6 }}>
                        Schedules a soft delete — account is locked for 30 days then permanently wiped.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
