/**
 * TutorialQuestionsPage — Browse TQs, solve with Padi, track credits.
 *
 * Route: /tutorial-questions
 *
 * Flow:
 *  - Unauthenticated / no subscription → preview mode (questions locked)
 *  - Subscribed → full access, solve button active, credits shown
 *
 * Math rendering: we use a lightweight inline KaTeX approach.
 * KaTeX must be loaded in index.html:
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
 *   <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
 *   <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams }              from 'react-router-dom'
import { useAuth }                                   from '../context/AuthContext'
import { getSubscriptionStatus }                     from '../lib/api.js'
import {
  getUserCourses,
  getCourseQuestions,
  solveQuestion,
  flagSolution,
  getSolveCredits,
  addUserCourse,
  searchCourses,
} from '../lib/contentApi.js'
import './TutorialQuestionsPage.css'

// Render KaTeX if available (loaded via CDN in index.html)
function renderMath(el) {
  if (!el || !window.renderMathInElement) return
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    })
  } catch {}
}

// ── Solution card ────────────────────────────────────────────────
function SolutionCard({ solution, onFlag }) {
  const contentRef = useRef(null)
  const [flagged,  setFlagged]  = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [copied,   setCopied]   = useState(false)

  useEffect(() => {
    renderMath(contentRef.current)
  }, [solution.solution_text])

  const handleFlag = async () => {
    if (flagged || flagging) return
    setFlagging(true)
    try {
      await flagSolution(solution.id, 'Incorrect or misleading solution')
      setFlagged(true)
      onFlag?.()
    } catch {
      // non-critical
    } finally {
      setFlagging(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(solution.solution_text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="tq-solution-card">
      <div className="tq-solution-header">
        <span className="tq-solution-label">✨ Padi's solution</span>
        <div className="tq-solution-actions">
          {solution.cached && <span className="tq-cached-badge">cached</span>}
          <button className="tq-action-btn" onClick={handleCopy} title="Copy solution">
            {copied ? '✓' : '📋'}
          </button>
          <button
            className={`tq-action-btn tq-flag-btn ${flagged ? 'flagged' : ''}`}
            onClick={handleFlag}
            disabled={flagging || flagged}
            title="Flag as incorrect">
            {flagged ? '🚩 Flagged' : '🚩'}
          </button>
        </div>
      </div>
      <div
        ref={contentRef}
        className="tq-solution-body markdown-body"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(solution.solution_text) }}
      />
      <div className="tq-solution-disclaimer">
        AI-generated. Verify with your textbook or lecturer for exam-critical material.
      </div>
    </div>
  )
}

// ── Minimal markdown renderer (no extra deps) ─────────────────────
function markdownToHtml(text) {
  if (!text) return ''
  return text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="tq-code-block"><code class="lang-${lang}">${escHtml(code.trim())}</code></pre>`)
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="tq-inline-code">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Numbered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Bullet list
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[hplico])(.+)$/gm, (m) => m)
    .replace(/^(.)/gm, (m) => m)
    // Wrap in p
    .replace(/^([^<].*)$/gm, (line) => {
      if (!line.trim()) return ''
      if (line.startsWith('<')) return line
      return `<p>${line}</p>`
    })
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ── Main page ─────────────────────────────────────────────────────
export default function TutorialQuestionsPage() {
  const { profile } = useAuth()
  const navigate      = useNavigate()
  const [params, setParams] = useSearchParams()

  const [subscription,  setSubscription]  = useState(null)
  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'past_due'

  // Course state
  const [userCourses,     setUserCourses]     = useState([])
  const [selectedCourse,  setSelectedCourse]  = useState(null)
  const [questions,       setQuestions]       = useState([])
  const [credits,         setCredits]         = useState({}) // { [courseId]: { remaining, total } }

  // UI state
  const [loadingCourses,  setLoadingCourses]  = useState(true)
  const [loadingQs,       setLoadingQs]       = useState(false)
  const [solvingId,       setSolvingId]       = useState(null)
  const [solutions,       setSolutions]       = useState({}) // { [questionId]: solution }
  const [expandedId,      setExpandedId]      = useState(null)
  const [contextMap,      setContextMap]      = useState({}) // { [questionId]: string }

  // Course search (for adding new courses)
  const [showSearch,      setShowSearch]      = useState(false)
  const [searchQ,         setSearchQ]         = useState('')
  const [searchResults,   setSearchResults]   = useState([])
  const [addingCourse,    setAddingCourse]    = useState(null)

  const [error,           setError]           = useState('')
  const [showUpgradeModal,  setShowUpgradeModal]  = useState(false)
  const [showCourseLimitModal, setShowCourseLimitModal] = useState(false)

  // Restore course from URL param
  const urlCourseId = params.get('course')

  // ── Load subscription status ──────────────────────────────────
  useEffect(() => {
    if (!profile) return
    getSubscriptionStatus()
      .then(data => setSubscription(data))
      .catch(() => {})
  }, [profile])

  // ── Load user courses ─────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    setLoadingCourses(true)
    getUserCourses()
      .then(d => {
        setUserCourses(d.courses || [])
        // Auto-select from URL or first course
        const initial = (d.courses || []).find(c => c.course_id === urlCourseId) || (d.courses || [])[0]
        if (initial) setSelectedCourse(initial)
      })
      .catch(() => setError('Could not load your courses.'))
      .finally(() => setLoadingCourses(false))
  }, [profile])

  // ── Load credits ──────────────────────────────────────────────
  useEffect(() => {
    if (!isSubscribed) return
    getSolveCredits()
      .then(d => {
        const map = {}
        ;(d.credits || []).forEach(c => {
          map[c.course_id] = { remaining: c.credits_remaining, total: c.credits_total }
        })
        setCredits(map)
      })
      .catch(() => {})
  }, [isSubscribed, userCourses])

  // ── Load questions when course selected ───────────────────────
  useEffect(() => {
    if (!selectedCourse) return
    setLoadingQs(true)
    setQuestions([])
    setExpandedId(null)
    const courseId = selectedCourse.course_id || selectedCourse.id
    setParams(p => { const np = new URLSearchParams(p); np.set('course', courseId); return np })

    getCourseQuestions(courseId)
      .then(d => setQuestions(d.questions || []))
      .catch(() => setError('Could not load questions for this course.'))
      .finally(() => setLoadingQs(false))
  }, [selectedCourse])

  // ── Solve ─────────────────────────────────────────────────────
  const handleSolve = async (question) => {
    if (!isSubscribed) { navigate('/pricing'); return }
    if (solvingId) return
    const qId = question.id

    // If already solved, just show it
    if (solutions[qId]) {
      setExpandedId(prev => prev === qId ? null : qId)
      return
    }

    setSolvingId(qId)
    setExpandedId(qId)
    setError('')
    try {
      const context = contextMap[qId] || ''
      const result  = await solveQuestion(qId, context)
      setSolutions(prev => ({ ...prev, [qId]: result.solution }))
      // Update credits locally
      if (result.creditsRemaining !== undefined) {
        const courseId = selectedCourse.course_id || selectedCourse.id
        setCredits(prev => ({
          ...prev,
          [courseId]: {
            ...prev[courseId],
            remaining: result.creditsRemaining,
          },
        }))
      }
    } catch (err) {
      const msg = err.message || 'Failed to solve — please try again.'
      if (msg.toLowerCase().includes('credit') || err.code === 'NO_CREDITS') {
        setShowUpgradeModal(true)
      } else {
        setError(msg)
      }
      setExpandedId(null)
    } finally {
      setSolvingId(null)
    }
  }

  // ── Course search ─────────────────────────────────────────────
  const handleSearch = useCallback(async (q) => {
    setSearchQ(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const d = await searchCourses(q)
      setSearchResults(d.courses || [])
    } catch {}
  }, [])

  const handleAddCourse = async (course) => {
    setAddingCourse(course.id)
    try {
      await addUserCourse(course.id)
      setUserCourses(prev => [...prev, { course_id: course.id, courses: course }])
      setShowSearch(false)
      setSearchQ('')
      setSearchResults([])
    } catch (err) {
      if (err.message?.includes('COURSE_LIMIT_REACHED') || err.message?.includes('9-course limit')) {
        setShowCourseLimitModal(true)
        setShowSearch(false)
      } else {
        setError(err.message || 'Failed to add course.')
      }
    } finally {
      setAddingCourse(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  const creditInfo = selectedCourse
    ? credits[selectedCourse.course_id || selectedCourse.id]
    : null

  const displayName = profile?.preferred_name || profile?.first_name || 'there'

  if (loadingCourses) {
    return (
      <div className="tq-loading-screen">
        <div className="tq-spinner" />
        <p>Loading your courses…</p>
      </div>
    )
  }

  return (
    <div className="tq-page">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="tq-header">
        <div>
          <h1 className="tq-title">Tutorial Questions</h1>
          <p className="tq-sub">Browse your course TQs and get step-by-step solutions from Padi</p>
        </div>
        {!isSubscribed && (
          <button className="btn btn-brand tq-subscribe-btn" onClick={() => navigate('/pricing')}>
            Unlock full access →
          </button>
        )}
      </div>

      {/* ── Subscription banner (non-subscribers) ───────────── */}
      {!isSubscribed && (
        <div className="tq-preview-banner">
          <span>🔒</span>
          <span>
            <strong>Preview mode</strong> — You can browse course codes but solutions are locked.{' '}
            <button className="tq-banner-link" onClick={() => navigate('/pricing')}>Subscribe from ₦3,000/month</button> to unlock everything.
          </span>
        </div>
      )}

      <div className="tq-layout">
        {/* ── Sidebar: course list ─────────────────────────── */}
        <aside className="tq-sidebar">
          <div className="tq-sidebar-header">
            <span className="tq-sidebar-title">My Courses</span>
            <button className="tq-add-course-btn" onClick={() => setShowSearch(s => !s)} title="Add a course">
              {showSearch ? '✕' : '＋'}
            </button>
          </div>

          {/* Course search */}
          {showSearch && (
            <div className="tq-course-search">
              <input
                type="text"
                className="tq-search-input"
                placeholder="Search course code or name…"
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="tq-search-results">
                  {searchResults.map(c => (
                    <button key={c.id} className="tq-search-result-item"
                      onClick={() => handleAddCourse(c)}
                      disabled={addingCourse === c.id ||
                        userCourses.some(uc => (uc.course_id || uc.id) === c.id)}>
                      <div>
                        <div className="tq-result-code">{c.course_code}</div>
                        <div className="tq-result-title">{c.course_title}</div>
                      </div>
                      {userCourses.some(uc => (uc.course_id || uc.id) === c.id)
                        ? <span className="tq-result-added">Added</span>
                        : addingCourse === c.id
                        ? <span className="tq-result-adding">Adding…</span>
                        : <span className="tq-result-add">＋ Add</span>
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Course list */}
          <div className="tq-course-list">
            {userCourses.length === 0 ? (
              <div className="tq-no-courses">
                <p>No courses yet.</p>
                <button className="tq-add-first" onClick={() => setShowSearch(true)}>
                  ＋ Add your first course
                </button>
              </div>
            ) : (
              userCourses.map(uc => {
                const c  = uc.courses || uc
                const id = uc.course_id || c.id
                const isActive = selectedCourse && (selectedCourse.course_id || selectedCourse.id) === id
                const cred = credits[id]
                return (
                  <button
                    key={id}
                    className={`tq-course-item ${isActive ? 'active' : ''}`}
                    onClick={() => { setSelectedCourse(uc); setError('') }}>
                    <div className="tq-course-item-code">{c.course_code || (c.courses && c.courses.course_code)}</div>
                    <div className="tq-course-item-title">{c.course_title || (c.courses && c.courses.course_title)}</div>
                    {cred && isSubscribed && (
                      <div className={`tq-credit-pill ${cred.remaining === 0 ? 'empty' : ''}`}>
                        {cred.remaining}/{cred.total} solves
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* ── Main: questions ──────────────────────────────── */}
        <main className="tq-main">
          {error && (
            <div className="tq-error-bar">
              ⚠️ {error}
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}

          {!selectedCourse ? (
            <div className="tq-empty-state">
              <div className="tq-empty-icon">📚</div>
              <h2>Select a course to get started</h2>
              <p>Choose a course from the sidebar to browse its tutorial questions.</p>
            </div>
          ) : loadingQs ? (
            <div className="tq-qs-loading">
              <div className="tq-spinner" />
              <p>Loading questions…</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="tq-empty-state">
              <div className="tq-empty-icon">🔍</div>
              <h2>No questions yet</h2>
              <p>Content for this course hasn't been uploaded yet. Check back soon — we're adding questions weekly.</p>
            </div>
          ) : (
            <>
              {/* Credit bar */}
              {isSubscribed && creditInfo && (
                <div className="tq-credits-bar">
                  <span>Solve credits this semester:</span>
                  <div className="tq-credits-track">
                    <div
                      className="tq-credits-fill"
                      style={{
                        width: `${Math.round((creditInfo.remaining / (creditInfo.total || 1)) * 100)}%`,
                        background: creditInfo.remaining > 1 ? '#4F46E5' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className={`tq-credits-count ${creditInfo.remaining === 0 ? 'empty' : ''}`}>
                    {creditInfo.remaining} / {creditInfo.total} remaining
                  </span>
                </div>
              )}

              {/* Question list */}
              <div className="tq-question-list">
                {questions.map((q, idx) => {
                  const isSolving  = solvingId === q.id
                  const hasSolution = !!solutions[q.id]
                  const isExpanded  = expandedId === q.id
                  const noCredits   = creditInfo?.remaining === 0 && !hasSolution

                  return (
                    <div key={q.id} className={`tq-question-card ${isExpanded ? 'expanded' : ''}`}>
                      <div className="tq-question-header" onClick={() => {
                        if (hasSolution) setExpandedId(p => p === q.id ? null : q.id)
                      }}>
                        <div className="tq-question-num">Q{q.question_number ?? idx + 1}</div>
                        <div className="tq-question-content">
                          <div className="tq-question-text">
                            {isSubscribed ? q.question_text : (
                              <>
                                {q.question_text?.slice(0, 60)}
                                {q.question_text?.length > 60 && (
                                  <span className="tq-locked-text">
                                    {'●'.repeat(Math.min(40, q.question_text.length - 60))}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {q.topic && <div className="tq-question-topic">{q.topic}</div>}
                        </div>

                        {isSubscribed ? (
                          <button
                            className={`tq-solve-btn ${hasSolution ? 'solved' : ''} ${noCredits ? 'no-credits' : ''}`}
                            disabled={isSolving}
                            onClick={e => {
                              e.stopPropagation()
                              if (noCredits) { setShowUpgradeModal(true); return }
                              handleSolve(q)
                            }}>
                            {isSolving
                              ? <><span className="tq-btn-spinner" /> Solving…</>
                              : hasSolution
                              ? (isExpanded ? '▲ Hide' : '▼ Show')
                              : noCredits
                              ? '🔓 Upgrade for more'
                              : '✨ Solve'}
                          </button>
                        ) : (
                          <button
                            className="tq-solve-btn locked"
                            onClick={() => navigate('/pricing')}>
                            🔒 Unlock
                          </button>
                        )}
                      </div>

                      {/* Context input (show before solving) */}
                      {isSubscribed && isExpanded && !hasSolution && !isSolving && (
                        <div className="tq-context-row">
                          <input
                            type="text"
                            className="tq-context-input"
                            placeholder="Optional: add context e.g. 'use the Henderson-Hasselbalch approach' or 'question is about OS scheduling'"
                            value={contextMap[q.id] || ''}
                            onChange={e => setContextMap(p => ({ ...p, [q.id]: e.target.value }))}
                          />
                        </div>
                      )}

                      {/* Solution */}
                      {isExpanded && hasSolution && (
                        <SolutionCard
                          solution={solutions[q.id]}
                          onFlag={() => {}}
                        />
                      )}

                      {/* Solving spinner */}
                      {isSolving && (
                        <div className="tq-solving-state">
                          <div className="tq-spinner" />
                          <p>Padi is working on this… usually takes 5–10 seconds</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Upgrade modal (credits exhausted) ───────────────── */}
      {showUpgradeModal && (
        <div className="tq-modal-backdrop" onClick={() => setShowUpgradeModal(false)}>
          <div className="tq-modal" onClick={e => e.stopPropagation()}>
            <button className="tq-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
            <div className="tq-modal-icon">🔓</div>
            <h2 className="tq-modal-title">Solve credits used up</h2>
            {profile?.plan_tier === 'premium' ? (
              <>
                <p className="tq-modal-body">
                  You've used all <strong>5 solution regenerations</strong> for this course this semester. Credits reset at the start of each new semester.
                </p>
                <p className="tq-modal-body" style={{ fontSize: 13, color: '#71717A' }}>
                  In the meantime, use Ask Padi to get explanations for specific parts of the question, or try the Exam Simulator to test yourself.
                </p>
                <button className="btn tq-modal-btn-ghost" onClick={() => setShowUpgradeModal(false)}>Got it</button>
              </>
            ) : (
              <>
                <p className="tq-modal-body">
                  You've used all <strong>3 solution regenerations</strong> for this course this semester (Base plan).
                </p>
                <p className="tq-modal-body">
                  Upgrade to <strong>Premium (₦7,000/month)</strong> for <strong>5 regenerations per course</strong>, plus Exam Simulator, Spaced Repetition, and unlimited Ask Padi.
                </p>
                <button className="btn btn-brand tq-modal-btn" onClick={() => navigate('/pricing')}>
                  Upgrade to Premium →
                </button>
                <button className="btn tq-modal-btn-ghost" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Course limit modal ───────────────────────────────── */}
      {showCourseLimitModal && (
        <div className="tq-modal-backdrop" onClick={() => setShowCourseLimitModal(false)}>
          <div className="tq-modal" onClick={e => e.stopPropagation()}>
            <button className="tq-modal-close" onClick={() => setShowCourseLimitModal(false)}>✕</button>
            <div className="tq-modal-icon">📚</div>
            <h2 className="tq-modal-title">9-course limit reached</h2>
            <p className="tq-modal-body">
              You've enrolled in the maximum of <strong>9 courses</strong> for this semester. If you're carrying more than usual, reach out and we'll add them for you.
            </p>
            <a
              href="mailto:support@yourpadi.com?subject=Add%20extra%20courses%20to%20my%20account"
              className="btn btn-brand tq-modal-btn"
              onClick={() => setShowCourseLimitModal(false)}>
              Contact support →
            </a>
            <button className="btn tq-modal-btn-ghost" onClick={() => setShowCourseLimitModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
