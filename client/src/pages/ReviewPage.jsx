import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getReviewItems, getReviewStats, submitReviewAnswer } from '../lib/aiApi.js'
import './ReviewPage.css'

// Quality ratings for SM-2 algorithm
const RATINGS = [
  { quality: 0, label: 'Blackout',   emoji: '😶', color: '#EF4444', bg: '#FEF2F2', desc: 'Complete blank' },
  { quality: 1, label: 'Wrong',      emoji: '❌', color: '#EF4444', bg: '#FEF2F2', desc: 'Incorrect' },
  { quality: 2, label: 'Hard',       emoji: '😰', color: '#F59E0B', bg: '#FFFBEB', desc: 'Wrong but familiar' },
  { quality: 3, label: 'Okay',       emoji: '😐', color: '#F59E0B', bg: '#FFFBEB', desc: 'Correct with effort' },
  { quality: 4, label: 'Good',       emoji: '✅', color: '#10B981', bg: '#D1FAE5', desc: 'Correct easily' },
  { quality: 5, label: 'Perfect',    emoji: '⭐', color: '#10B981', bg: '#D1FAE5', desc: 'Instant recall' },
]

export default function ReviewPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [items,    setItems]    = useState([])
  const [stats,    setStats]    = useState({ due: 0, total: 0 })
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState('')
  const [current,  setCurrent]  = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [phase,    setPhase]    = useState('review') // 'review' | 'done'
  const [results,  setResults]  = useState([])
  const [submitting, setSubmitting] = useState(false)

  const loadReview = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [itemsRes, statsRes] = await Promise.all([getReviewItems(), getReviewStats()])
      setItems(itemsRes.items || [])
      setStats(statsRes)
    } catch (err) {
      setLoadError(err.message || 'Could not load review items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.plan_tier === 'premium') loadReview()
    else setLoading(false)
  }, [profile?.plan_tier])

  // ── Premium gate ──────────────────────────────────────────────────
  if (profile && profile.plan_tier !== 'premium') {
    return (
      <div className="review-page">
        <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Premium feature</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Spaced repetition is available on the Premium plan — flashcards that adapt to what you actually need to revise.
          </p>
          <button
            style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
            onClick={() => navigate('/pricing')}
          >
            Upgrade to Premium
          </button>
        </div>
      </div>
    )
  }

  const handleRate = async (quality) => {
    if (submitting) return
    const item = items[current]
    setSubmitting(true)

    try {
      await submitReviewAnswer({ itemId: item.id, quality })
      setResults(prev => [...prev, { item, quality }])

      if (current + 1 >= items.length) {
        setPhase('done')
      } else {
        setCurrent(prev => prev + 1)
        setRevealed(false)
      }
    } catch (err) {
      console.error('Rate error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const progress = items.length > 0 ? (current / items.length) * 100 : 0
  const item = items[current]

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-loading">
          <div className="review-spinner" />
          <p>Loading your review session...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="review-page">
        <div className="review-header">
          <h1 className="review-title">Spaced Repetition</h1>
        </div>
        <div className="review-empty">
          <div className="review-empty-icon">⚠️</div>
          <h2 className="review-empty-title">Couldn't load your session</h2>
          <p className="review-empty-sub">{loadError}</p>
          <button className="btn btn-brand" style={{marginTop:16}} onClick={loadReview}>Try again</button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="review-page">
        <div className="review-header">
          <h1 className="review-title">Spaced Repetition</h1>
          <p className="review-sub">Review items scheduled by Padi to maximise long-term memory retention.</p>
        </div>
        <div className="review-empty">
          <div className="review-empty-icon">🎉</div>
          <h2 className="review-empty-title">All caught up!</h2>
          <p className="review-empty-sub">
            You have no items due for review today. Padi will schedule your next session
            based on how well you knew each item last time.
          </p>
          <div className="review-stats-row">
            <div className="review-stat">
              <div className="review-stat-num">{stats.total}</div>
              <div className="review-stat-label">Total items</div>
            </div>
            <div className="review-stat">
              <div className="review-stat-num">0</div>
              <div className="review-stat-label">Due today</div>
            </div>
          </div>
          <p className="review-tip">
            💡 Generate a study pack to automatically add items to your review queue.
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const perfect  = results.filter(r => r.quality >= 4).length
    const okay     = results.filter(r => r.quality === 3).length
    const wrong    = results.filter(r => r.quality < 3).length
    const pct      = Math.round((perfect / results.length) * 100)

    return (
      <div className="review-page">
        <div className="review-done">
          <div className="review-done-icon">{pct >= 80 ? '🌟' : pct >= 50 ? '📚' : '💪'}</div>
          <h2 className="review-done-title">Session complete!</h2>
          <p className="review-done-sub">{results.length} cards reviewed</p>

          <div className="review-done-stats">
            <div className="review-done-stat perfect">
              <span className="review-done-num">{perfect}</span>
              <span className="review-done-label">Good/Perfect</span>
            </div>
            <div className="review-done-stat okay">
              <span className="review-done-num">{okay}</span>
              <span className="review-done-label">Okay</span>
            </div>
            <div className="review-done-stat wrong">
              <span className="review-done-num">{wrong}</span>
              <span className="review-done-label">Missed</span>
            </div>
          </div>

          <p className="review-done-message">
            {pct >= 80
              ? 'Excellent work! Padi has scheduled your next reviews further out.'
              : pct >= 50
              ? 'Good effort. Items you struggled with will come back sooner for extra practice.'
              : 'Keep studying. Padi will bring back the difficult items tomorrow.'}
          </p>

          <button
            className="btn btn-brand"
            onClick={() => { setCurrent(0); setRevealed(false); setPhase('review'); setResults([]); loadReview() }}
          >
            Start another session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="review-page">
      <div className="review-header">
        <div>
          <h1 className="review-title">Daily Review</h1>
          <p className="review-sub">{items.length} items due today</p>
        </div>
        <div className="review-progress-label">
          {current + 1} / {items.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="review-progress">
        <div className="review-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      <div className="review-card">
        <div className="review-card-type">{item?.item_type === 'concept' ? '🔑 Concept' : '🃏 Flashcard'}</div>

        <div className="review-card-front">
          <div className="review-card-label">Question</div>
          <div className="review-card-text">{item?.front}</div>
        </div>

        {!revealed ? (
          <button className="review-reveal-btn" onClick={() => setRevealed(true)}>
            Tap to reveal answer
          </button>
        ) : (
          <>
            <div className="review-card-back">
              <div className="review-card-label">Answer</div>
              <div className="review-card-text">{item?.back}</div>
            </div>

            <div className="review-rate-label">How well did you know this?</div>
            <div className="review-ratings">
              {RATINGS.map(r => (
                <button
                  key={r.quality}
                  className="review-rating-btn"
                  style={{ '--rating-color': r.color, '--rating-bg': r.bg }}
                  onClick={() => handleRate(r.quality)}
                  disabled={submitting}
                >
                  <span className="review-rating-emoji">{r.emoji}</span>
                  <span className="review-rating-label">{r.label}</span>
                  <span className="review-rating-desc">{r.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="review-disclaimer">
        Ratings affect when this card appears next. Higher ratings = longer intervals before next review.
      </div>
    </div>
  )
}
