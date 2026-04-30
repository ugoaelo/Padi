import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProgress } from '../lib/api.js'
import { getStoredAIRemaining, AI_DAILY_LIMIT } from '../lib/aiQuota.js'
import { getUserCourses, getSolveCredits } from '../lib/contentApi.js'
import './DashboardPage.css'

const QUICK_ACTIONS = [
  { icon: '📖', label: 'Tutorial Questions', to: '/tutorial-questions', color: '#EDE9FE', section: 'tutorial-questions' },
  { icon: '💬', label: 'Ask a question',     to: '/ask',                color: '#EEF2FF', section: 'ask' },
  { icon: '📦', label: 'Study packs',        to: '/study-packs',        color: '#D1FAE5', section: 'study-packs' },
  { icon: '🎯', label: 'Exam simulator',     to: '/exam',               color: '#FEE2E2', section: 'exam' },
  { icon: '💾', label: 'My library',         to: '/library',            color: '#FEF3C7', section: 'library' },
]

const SECTION_LABELS = {
  ask:             'Ask page',
  'study-packs':   'Study Packs',
  exam:            'Exam Simulator',
  'past-questions':'Tutorial Questions',
  review:          'Review',
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [progress,    setProgress]    = useState(null)
  const [aiRemaining, setAiRemaining] = useState(getStoredAIRemaining())
  const [userCourses, setUserCourses] = useState([])
  const [credits,     setCredits]     = useState({})

  // ── Session advancement banner (August only) ──────────────────
  const currentMonth = new Date().getMonth() // 0-indexed; 7 = August
  const currentYear  = new Date().getFullYear()
  const bannerDismissedYear = parseInt(localStorage.getItem('padi_session_banner_dismissed') || '0')
  const [showSessionBanner, setShowSessionBanner] = useState(
    currentMonth === 7 && bannerDismissedYear < currentYear
  )
  const dismissSessionBanner = () => {
    localStorage.setItem('padi_session_banner_dismissed', String(currentYear))
    setShowSessionBanner(false)
  }

  const displayName = profile?.preferred_name || profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'
  const hour        = new Date().getHours()
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Guard: incomplete profile → redirect to onboarding ───────
  useEffect(() => {
    if (profile && !profile.school_id) {
      navigate('/onboarding', { replace: true })
    }
  }, [profile, navigate])

  // ── Load progress + courses on mount ─────────────────────────
  useEffect(() => {
    getUserProgress()
      .then(data => {
        setProgress(data)
        if (data.aiRemaining !== undefined) setAiRemaining(data.aiRemaining)
      })
      .catch(() => {})

    getUserCourses()
      .then(d => setUserCourses(d.courses || []))
      .catch(() => {})

    getSolveCredits()
      .then(d => {
        const map = {}
        ;(d.credits || []).forEach(c => { map[c.course_id] = c })
        setCredits(map)
      })
      .catch(() => {})
  }, [])

  // ── Listen for AI quota updates from aiFetch ──────────────────
  useEffect(() => {
    function handleQuota(e) { setAiRemaining(e.detail.remaining) }
    window.addEventListener('padi:ai-remaining', handleQuota)
    return () => window.removeEventListener('padi:ai-remaining', handleQuota)
  }, [])

  const aiPct           = Math.min(100, Math.round((aiRemaining / AI_DAILY_LIMIT) * 100))
  const aiBarColor      = aiPct > 40 ? '#4F46E5' : aiPct > 15 ? '#F59E0B' : '#EF4444'
  const hasProgress     = progress && (progress.examsCompleted > 0 || progress.topicsStudied > 0 || progress.packsGenerated > 0)
  const hasResume       = progress?.lastTopic && progress?.lastSection

  return (
    <div className="dashboard">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-greeting">{greeting}, {displayName} 👋</h1>
          <p className="dashboard-sub">{profile?.course ? `${profile.course} · ${profile.university}` : 'Ready to study smarter?'}</p>
        </div>
        {profile?.founding_member && <div className="dashboard-founding-badge">⭐ Founding Member</div>}
      </div>

      {/* ── Session advancement banner (August) ────────────���──── */}
      {showSessionBanner && (
        <div className="dashboard-session-banner">
          <div className="dashboard-session-banner-body">
            <span className="dashboard-session-banner-icon">📅</span>
            <div>
              <strong>New academic session starts September 1.</strong>
              <span> Your courses and study packs will reset. Re-enrol in your new semester courses from September.</span>
            </div>
          </div>
          <button className="dashboard-session-banner-dismiss" onClick={dismissSessionBanner} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Resume where you left off ──────────────────────────── */}
      {hasResume && (
        <button
          className="dashboard-resume-card"
          onClick={() => navigate(`/${progress.lastSection}`)}
        >
          <div className="dashboard-resume-icon">▶️</div>
          <div>
            <div className="dashboard-resume-label">Resume where you left off</div>
            <div className="dashboard-resume-detail">
              {SECTION_LABELS[progress.lastSection] || progress.lastSection}
              {progress.lastTopic ? ` · ${progress.lastTopic}` : ''}
            </div>
          </div>
          <div className="dashboard-resume-arrow">→</div>
        </button>
      )}

      {/* ── Progress stats ─────────────────────────────────────── */}
      {hasProgress && (
        <>
          <div className="dashboard-section-label">Your progress</div>
          <div className="dashboard-stats">
            {progress.examsCompleted > 0 && (
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{progress.examsCompleted}</div>
                <div className="dashboard-stat-label">Exams taken</div>
              </div>
            )}
            {progress.avgScore !== null && (
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{progress.avgScore}%</div>
                <div className="dashboard-stat-label">Avg score</div>
              </div>
            )}
            {progress.topicsStudied > 0 && (
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{progress.topicsStudied}</div>
                <div className="dashboard-stat-label">Topics uploaded</div>
              </div>
            )}
            {progress.packsGenerated > 0 && (
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-value">{progress.packsGenerated}</div>
                <div className="dashboard-stat-label">Study packs</div>
              </div>
            )}
            {progress.reviewItemsDue > 0 && (
              <div className="dashboard-stat-card dashboard-stat-card--due" onClick={() => navigate('/review')} style={{ cursor: 'pointer' }}>
                <div className="dashboard-stat-value">{progress.reviewItemsDue}</div>
                <div className="dashboard-stat-label">Cards due</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── AI sessions today ──────────────────────────────────── */}
      <div className="dashboard-ai-quota">
        <div className="dashboard-ai-quota-header">
          <span className="dashboard-ai-quota-label">✨ Today's study sessions</span>
          <span className="dashboard-ai-quota-count" style={{ color: aiBarColor }}>
            {aiRemaining} / {AI_DAILY_LIMIT} remaining
          </span>
        </div>
        <div className="dashboard-ai-quota-track">
          <div className="dashboard-ai-quota-fill" style={{ width: `${aiPct}%`, background: aiBarColor }} />
        </div>
        {aiRemaining === 0 && (
          <p className="dashboard-ai-quota-hint">
            Limit resets at midnight · Review your saved library and flashcards in the meantime
          </p>
        )}
      </div>

      {/* ── My courses ─────────────────────────────────────────── */}
      {userCourses.length > 0 && (
        <>
          <div className="dashboard-section-label">My courses</div>
          <div className="dashboard-courses">
            {userCourses.slice(0, 6).map(uc => {
              const c      = uc.courses || uc
              const id     = uc.course_id || c.id
              const code   = c.course_code  || (c.courses && c.courses.course_code)  || '—'
              const title  = c.course_title || (c.courses && c.courses.course_title) || '—'
              const cred   = credits[id]
              return (
                <button
                  key={id}
                  className="dashboard-course-card"
                  onClick={() => navigate(`/tutorial-questions?course=${id}`)}>
                  <div className="dashboard-course-code">{code}</div>
                  <div className="dashboard-course-title">{title}</div>
                  {cred && (
                    <div className={`dashboard-course-credits ${cred.credits_remaining === 0 ? 'empty' : ''}`}>
                      {cred.credits_remaining}/{cred.credits_total} solves left
                    </div>
                  )}
                </button>
              )
            })}
            <button
              className="dashboard-course-card dashboard-course-add"
              onClick={() => navigate('/tutorial-questions')}>
              <div style={{ fontSize: 20 }}>＋</div>
              <div style={{ fontSize: 12, color: '#71717A' }}>Add course</div>
            </button>
          </div>
        </>
      )}

      {/* ── Quick actions ──────────────────────────────────────── */}
      <div className="dashboard-section-label">Quick actions</div>
      <div className="dashboard-actions">
        {QUICK_ACTIONS.map(action => (
          <button key={action.to} className="dashboard-action-card"
            style={{ '--card-bg': action.color }} onClick={() => navigate(action.to)}>
            <div className="dashboard-action-icon">{action.icon}</div>
            <div className="dashboard-action-label">{action.label}</div>
          </button>
        ))}
      </div>

      <div className="dashboard-tip">
        <div className="dashboard-tip-icon">💡</div>
        <div>
          <div className="dashboard-tip-title">Get the most out of Padi</div>
          <div className="dashboard-tip-text">Upload your lecture notes or past papers to personalise every AI answer to your actual course material.</div>
        </div>
      </div>
      <div className="dashboard-disclaimer">🤖 Padi uses AI to generate study materials. Always verify important information with your lecturer, textbook, or official course material.</div>
    </div>
  )
}
