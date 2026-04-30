import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Hero.css'

const TOTAL_FOUNDING_SPOTS = 100
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function Hero({ onCTAClick }) {
  const fillRef    = useRef(null)
  const navigate   = useNavigate()
  const [spotsUsed,      setSpotsUsed]      = useState(0)
  const [spotsRemaining, setSpotsRemaining] = useState(TOTAL_FOUNDING_SPOTS)
  const [foundingOpen,   setFoundingOpen]   = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/payments/founding-count`)
      .then(r => r.json())
      .then(data => {
        const used      = data.count || 0
        const remaining = Math.max(0, TOTAL_FOUNDING_SPOTS - used)
        setSpotsUsed(used)
        setSpotsRemaining(remaining)
        setFoundingOpen(remaining > 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const pct   = (spotsUsed / TOTAL_FOUNDING_SPOTS) * 100
    const timer = setTimeout(() => {
      if (fillRef.current) fillRef.current.style.width = pct + '%'
    }, 800)
    return () => clearTimeout(timer)
  }, [spotsUsed])

  const handleCTA = () => {
    if (foundingOpen) {
      onCTAClick()
    } else {
      navigate('/signup')
    }
  }

  return (
    <section className="hero">
      <div className="hero-glow" />

      <div className="hero-badge">
        <span className="hero-badge-dot" />
        {foundingOpen
          ? `Founding member offer · Only ${TOTAL_FOUNDING_SPOTS} spots`
          : 'Now open · Sign up to get started'}
      </div>

      <h1 className="hero-headline">
        ChatGPT answers questions.<br />
        <em>Padi passes exams.</em>
      </h1>

      <p className="hero-sub">
        Instant answers, note summaries, personalised study packs, and exam simulations — built around your course, your materials, and your exams.
      </p>

      <div className="hero-actions">
        <button className="btn btn-brand btn-lg" onClick={handleCTA}>
          {foundingOpen ? 'Get founding access ↗' : 'Sign Up Now ↗'}
        </button>
        <a href="#how-it-works" className="btn btn-ghost btn-lg">
          See how it works
        </a>
      </div>

      {foundingOpen && (
        <div className="founding-counter">
          <span>Founding spots remaining:</span>
          <div className="founding-counter-bar">
            <div className="founding-counter-fill" ref={fillRef} />
          </div>
          <strong>{spotsRemaining}</strong> of {TOTAL_FOUNDING_SPOTS}
        </div>
      )}

      {/* ── APP MOCKUP ── */}
      <div className="hero-mockup-wrap">
        <div className="hero-mockup-glow" />
        <div className="hero-mockup">
          <div className="mockup-topbar">
            <div className="mockup-dots">
              <div className="mockup-dot" />
              <div className="mockup-dot" />
              <div className="mockup-dot" />
            </div>
            <div className="mockup-url">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              yourpadi.com/study
            </div>
            <div style={{width: 60}} />
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              {[{label:'Tutorial Questions',active:true},{label:'Ask Padi'},{label:'Study Packs'},{label:'Exam Sim'},{label:'My Library'}].map(({label, active}) => (
                <div key={label} className={`mockup-sidebar-item ${active ? 'active' : ''}`}>
                  <div className="mockup-sidebar-icon" />{label}
                </div>
              ))}
            </div>
            <div className="mockup-main">
              <div className="mockup-input-row">
                <div className="mockup-input">
                  <span className="mockup-input-placeholder">Derive the time complexity of binary search and prove the recurrence relation...</span>
                </div>
                <div className="mockup-send-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
              </div>
              <div className="mockup-response-card">
                <div className="mockup-response-header">
                  <div className="mockup-padi-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
                    </svg>
                  </div>
                  <span className="mockup-response-label">Padi</span>
                  <span className="mockup-response-meta">CMP 201 · Step-by-step solution</span>
                </div>
                <div className="mockup-skeleton-lines">
                  <div className="mockup-skeleton" style={{width:'95%'}} />
                  <div className="mockup-skeleton" style={{width:'88%'}} />
                  <div className="mockup-skeleton" style={{width:'72%', animationDelay:'0.2s'}} />
                </div>
                <div className="mockup-action-row">
                  <div className="mockup-action-chip green">💾 Save solution</div>
                  <div className="mockup-action-chip">📐 View working</div>
                  <div className="mockup-action-chip">🚩 Flag</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}