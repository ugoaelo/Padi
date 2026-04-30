import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Hero from '../components/Hero.jsx'
import WaitlistForm from '../components/WaitlistForm.jsx'
import Footer from '../components/Footer.jsx'
import './LandingPage.css'

const SHOW_STATS = false
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const FEATURES = [
  { icon: '📖', title: 'Tutorial Question Bank', desc: 'Access your department\'s past tutorial questions directly in Padi. Curated, organised by course and topic — no more hunting through WhatsApp groups.', tint: '#EDE9FE' },
  { icon: '✨', title: 'AI-Powered Solutions', desc: 'Click Solve on any TQ. Padi generates a full, step-by-step solution tuned to your discipline — with working for maths, pseudocode for computing, and laws for science.', tint: '#EEF2FF' },
  { icon: '📝', title: 'Instant Answers', desc: 'Type any question — concept, calculation, or definition. Padi explains it clearly with examples, not jargon. Citations included.', tint: '#D1FAE5' },
  { icon: '📦', title: 'Study Pack Generator', desc: 'One topic becomes a full learning package — notes, flashcards, quizzes, and concept reviews. Personalised to your course and level.', tint: '#FEF3C7' },
  { icon: '🎯', title: 'Exam Simulation', desc: 'Timed, scored mock exams built from your own material. Review your answers, understand your mistakes, track your progress.', tint: '#FEE2E2' },
  { icon: '🧠', title: 'Spaced Repetition', desc: 'Padi schedules what you need to review and when — at 1, 3, 7, and 14 day intervals. Memory science, built in.', tint: '#CFFAFE' },
  { icon: '📐', title: 'Step-by-Step Maths', desc: "Every calculation shown in full working. Not just the answer — the method. Rendered with proper mathematical notation.", tint: '#D1FAE5' },
  { icon: '💾', title: 'Offline Library', desc: 'Save any generated content to your personal Library. Access it offline — no internet required. Study on the bus, between lectures, anywhere.', tint: '#EEF2FF' },
]

const HOW_TABS = [
  {
    id: 'ask', label: 'Ask Padi',
    title: 'Ask anything. Get clarity.',
    desc: 'Type any question from your course and Padi explains it clearly — with examples, citations, and in plain language. Then refine the answer to exactly what you need.',
    steps: ['Type your question or topic', 'Padi generates a clear, cited explanation', 'Refine — "simplify this", "give me just the key points", "make practice questions"', 'Save to Library or share to WhatsApp'],
  },
  {
    id: 'studypack', label: 'Study Packs',
    title: 'One upload. A full study pack.',
    desc: 'Upload your lecture slides or paste a topic. Padi converts it into a complete learning package — structured notes, flashcards, quizzes, and concept reviews.',
    steps: ['Upload PDF, paste text, or type a topic', 'Padi generates the full study pack', 'Review notes, test yourself on flashcards, take the quiz', 'Pack saves to your Library for offline access'],
  },
  {
    id: 'exam', label: 'Exam Sim',
    title: "Practice like it's the real thing.",
    desc: 'Timed mock exams built from your own material. Padi scores your performance, shows where you went wrong, and tells you exactly what to focus on next.',
    steps: ['Select a topic or study pack', 'Set your time limit and question count', 'Complete the timed simulation', 'Review results — weak areas flagged, next steps recommended'],
  },
  {
    id: 'pastq', label: 'Tutorial Questions',
    title: 'Your department\'s TQs. Solved by AI.',
    desc: 'Browse every tutorial question for your enrolled courses — organised by topic and semester. Click Solve on any question and Padi generates a full, step-by-step solution in seconds.',
    steps: ['Enrol in your courses during onboarding', 'Browse your department\'s tutorial questions by topic', 'Click Solve — Padi generates a full worked solution', 'Solutions are cached: every student after you gets it instantly'],
  },
  {
    id: 'offline', label: 'Offline Library',
    title: 'Study anywhere. Even offline.',
    desc: "Save any answer, summary, or study pack to your personal Library. Once saved, it's yours — accessible without internet, from any device you're signed into.",
    steps: ['Generate any content with Padi', 'Tap "Save to Library" on any output', 'Access your Library tab at any time — no internet needed', 'Study on the bus, between lectures, wherever you are'],
  },
]

const COMPARE_ROWS = [
  { feature: 'Price', padi: 'From ₦3,000/month (~$2)', chatgpt: '₦7,000–₦33,000/month', padiGood: true, chatgptGood: false },
  { feature: 'Tutorial question bank', padi: 'Department-curated TQs', chatgpt: 'Not available', padiGood: true, chatgptGood: false },
  { feature: 'Step-by-step TQ solutions', padi: 'Built in (AI-generated)', chatgpt: 'Manual prompting', padiGood: true, chatgptGood: null },
  { feature: 'Built for exam prep', padi: 'Yes — only purpose', chatgpt: 'General purpose', padiGood: true, chatgptGood: false },
  { feature: 'Instant answers + maths', padi: 'Premium — unlimited', chatgpt: 'Manual prompting', padiGood: true, chatgptGood: null },
  { feature: 'Study packs + flashcards', padi: 'Premium — one click', chatgpt: 'Manual prompting', padiGood: true, chatgptGood: false },
  { feature: 'Exam simulation', padi: 'Premium — timed + scored', chatgpt: 'Not available', padiGood: true, chatgptGood: false },
  { feature: 'Offline access', padi: 'Full library', chatgpt: 'Requires internet', padiGood: true, chatgptGood: false },
  { feature: 'Spaced repetition', padi: 'Premium — built in', chatgpt: 'Not available', padiGood: true, chatgptGood: false },
]

const BASE_FEATURES = [
  'Tutorial question bank — browse all courses',
  'Step-by-step AI solutions to your tutorial questions',
  'Offline library — save anything',
]

const PREMIUM_FEATURES = [
  'Everything in Base',
  'Ask Padi — instant answers to any topic or concept',
  'Step-by-step maths solutions',
  'Study pack generator — notes, flashcards & quizzes',
  'Exam simulations — timed & scored',
  'Spaced repetition scheduling',
  'Unlimited practice question generation',
  'Past paper pattern analysis',
  'Citations on every answer',
  'Priority AI (faster responses)',
]

export default function LandingPage() {
  const activeTab  = useRef('ask')
  const navigate   = useNavigate()
  const [foundingOpen,    setFoundingOpen]    = useState(true)
  const [spotsRemaining,  setSpotsRemaining]  = useState(100)

  // Fetch real founding count
  useEffect(() => {
    fetch(`${API_URL}/api/payments/founding-count`)
      .then(r => r.json())
      .then(data => {
        const remaining = Math.max(0, 100 - (data.count || 0))
        setSpotsRemaining(remaining)
        setFoundingOpen(remaining > 0)
      })
      .catch(() => {})
  }, [])

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay || 0
            setTimeout(() => entry.target.classList.add('visible'), parseInt(delay))
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.feature-card, .demo-step').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const switchTab = (tabId) => {
    document.querySelectorAll('.how-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.how-panel').forEach(p => p.classList.remove('active'))
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active')
    document.querySelector(`[data-panel="${tabId}"]`)?.classList.add('active')
    activeTab.current = tabId
  }

  const scrollToSection = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCTA = () => {
    if (foundingOpen) scrollToSection()
    else navigate('/signup')
  }

  return (
    <div className="page-card">
      <div className="grid-bg" />

      <Navbar foundingOpen={foundingOpen} onCTAClick={handleCTA} />

      <Hero onCTAClick={handleCTA} foundingOpen={foundingOpen} spotsRemaining={spotsRemaining} />

      {/* ── HOW PADI WORKS DEMO ── */}
      <section className="demo-section" id="demo">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">How Padi works</div>
            <h2 className="section-title">From material to exam-ready<br /><span>in minutes, not days.</span></h2>
          </div>
          <div className="demo-screen">
            <div className="demo-topbar">
              <div className="mockup-dots">
                <div className="mockup-dot" style={{background:'#FF5F57'}} />
                <div className="mockup-dot" style={{background:'#FEBC2E'}} />
                <div className="mockup-dot" style={{background:'#28C840'}} />
              </div>
              <span className="demo-title-text">Padi in action</span>
              <div style={{width:60}} />
            </div>
            <div className="demo-steps">
              {[
                { num:'01', icon:'🎓', iconBg:'rgba(79,70,229,0.2)', title:'Enrol in your courses', desc:'Pick your university, department, and courses during onboarding. Padi loads your tutorial questions automatically — no uploads needed.' },
                { num:'02', icon:'📖', iconBg:'rgba(16,185,129,0.2)', title:'Browse your TQs', desc:'Every tutorial question for your enrolled courses, organised by topic and semester. No more hunting through WhatsApp groups.' },
                { num:'03', icon:'✨', iconBg:'rgba(245,158,11,0.2)', title:'Click Solve', desc:'Tap Solve on any question. Padi generates a full, step-by-step solution in seconds — tailored to your discipline and level.' },
              ].map((step, i) => (
                <div key={step.num} className="demo-step" data-delay={i * 150}>
                  <div className="demo-step-num">{step.num}</div>
                  <div className="demo-step-icon" style={{background: step.iconBg}}>{step.icon}</div>
                  <div className="demo-step-title">{step.title}</div>
                  <div className="demo-step-desc">{step.desc}</div>
                  {i < 2 && <div className="demo-connector" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">Everything you need</div>
            <h2 className="section-title">Built for one thing.<br /><span>Helping you pass.</span></h2>
            <p className="section-sub">Every feature is designed around how students actually study — not how AI companies think they should.</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" data-delay={i * 80} style={{'--card-tint': f.tint + '18'}}>
                <div className="feature-icon-wrap" style={{background: f.tint}}>{f.icon}</div>
                <div className="feature-card-title">{f.title}</div>
                <div className="feature-card-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS TABS ── */}
      <section className="how-section" id="how-it-works">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">Feature walkthrough</div>
            <h2 className="section-title">See exactly how<br /><span>each feature works.</span></h2>
          </div>
          <div className="how-tabs">
            {HOW_TABS.map((tab, i) => (
              <button key={tab.id} className={`how-tab ${i === 0 ? 'active' : ''}`}
                data-tab={tab.id} onClick={() => switchTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          {HOW_TABS.map((tab, i) => (
            <div key={tab.id} className={`how-panel ${i === 0 ? 'active' : ''}`} data-panel={tab.id}>
              <div className="how-panel-text">
                <h3>{tab.title}</h3>
                <p>{tab.desc}</p>
                <div className="how-panel-steps">
                  {tab.steps.map((step, j) => (
                    <div key={j} className="how-step-item">
                      <div className="how-step-num">{j + 1}</div>
                      <div className="how-step-text">{step}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="how-panel-visual">
                <div className="how-panel-visual-label">{tab.label} — feature preview</div>
                <div className="how-panel-visual-placeholder"><span>{tab.steps[0]}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section id="compare">
        <div className="section-inner">
          <div className="section-header">
            <div className="section-label">The honest comparison</div>
            <h2 className="section-title">Why Padi over<br /><span>everything else?</span></h2>
          </div>
          <div className="compare-table">
            <div className="compare-header">
              <div className="compare-col-header"></div>
              <div className="compare-col-header padi-col">✦ Padi</div>
              <div className="compare-col-header">ChatGPT</div>
            </div>
            {COMPARE_ROWS.map(row => (
              <div key={row.feature} className="compare-row">
                <div className="compare-cell feature-name">{row.feature}</div>
                <div className="compare-cell padi-col"><span className="check">✓</span> {row.padi}</div>
                <div className="compare-cell">
                  {row.chatgptGood === false && <span className="cross">✗</span>}
                  {row.chatgptGood === null  && <span className="partial">~</span>}
                  {row.chatgptGood === true  && <span className="check">✓</span>}
                  {' '}{row.chatgpt}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS (hidden until users) ── */}
      {SHOW_STATS && (
        <section className="stats-section" id="stats">
          <div className="section-inner" style={{textAlign:'center'}}>
            <div className="section-label" style={{justifyContent:'center'}}>By the numbers</div>
            <h2 className="section-title">Students are already<br /><span>passing with Padi.</span></h2>
            <div className="stats-grid">
              {[{icon:'🎓',value:'0',label:'Active students'},{icon:'📦',value:'0',label:'Study packs generated'},{icon:'🏫',value:'0',label:'Universities represented'}].map(stat => (
                <div key={stat.label} className="stat-card">
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRICING ── */}
      <section className="pricing-section" id="pricing">
        <div className="section-inner" style={{textAlign:'center'}}>
          <div className="section-label" style={{justifyContent:'center'}}>Simple pricing</div>
          <h2 className="section-title">Two plans. No hidden costs.<br /><span>Both include TQ access.</span></h2>
          {foundingOpen && (
            <div className="pricing-founding-banner">
              🌟 <strong>First cohort:</strong> First 100 students get ₦1,500 (Base) or ₦2,500 (Premium) for month 1 — then locked at ₦3,000 or ₦4,500/month forever.
            </div>
          )}
          <div className="pricing-two-col">

            {/* Base */}
            <div className="pricing-card pricing-card--base">
              <div className="pricing-card-header">
                <div className="pricing-badge-text">Base</div>
                <div className="pricing-price">
                  <span className="pricing-currency">₦</span>3,000
                </div>
                {foundingOpen && <div className="pricing-period" style={{color:'rgba(255,255,255,0.95)', fontWeight:600, marginBottom:4}}>₦1,500 your first month</div>}
                <div className="pricing-period">{foundingOpen ? 'then ₦3,000/month · founding rate locked' : 'per month · cancel any time'}</div>
              </div>
              <div className="pricing-card-body">
                <ul className="pricing-features-list">
                  {BASE_FEATURES.map(f => <li key={f}><span className="pricing-check-icon">✓</span>{f}</li>)}
                </ul>
                <button className="btn btn-brand pricing-cta" onClick={handleCTA}>
                  {foundingOpen ? 'Get founding Base ↗' : 'Get started ↗'}
                </button>
              </div>
            </div>

            {/* Premium */}
            <div className="pricing-card pricing-card--premium">
              <div className="pricing-card-header">
                <div style={{display:'inline-block', position:'relative', top:'auto', left:'auto', transform:'none', background:'rgba(255,255,255,0.2)', color:'white', fontSize:11, fontWeight:700, padding:'4px 14px', borderRadius:20, marginBottom:12, whiteSpace:'nowrap', letterSpacing:'0.06em'}}>Most powerful</div>
                <div className="pricing-badge-text">Premium</div>
                <div className="pricing-price">
                  <span className="pricing-currency">₦</span>7,000
                </div>
                {foundingOpen && <div className="pricing-period" style={{color:'rgba(255,255,255,0.95)', fontWeight:600, marginBottom:4}}>₦2,500 your first month</div>}
                <div className="pricing-period">{foundingOpen ? 'then ₦4,500/month · founding rate locked' : 'per month · cancel any time'}</div>
              </div>
              <div className="pricing-card-body">
                <ul className="pricing-features-list">
                  {PREMIUM_FEATURES.map(f => <li key={f}><span className="pricing-check-icon">✓</span>{f}</li>)}
                </ul>
                <button className="btn btn-brand pricing-cta" onClick={handleCTA}>
                  {foundingOpen ? 'Get founding Premium ↗' : 'Go Premium ↗'}
                </button>
              </div>
            </div>

          </div>
          <p className="pricing-refund">🛡️ 48-hour full refund on both plans. No questions asked.</p>
        </div>
      </section>

      {/* ── FIRST COHORT / SIGNUP SECTION ── */}
      <section className="waitlist-section" id="waitlist">
        <div className="waitlist-inner">
          {foundingOpen ? (
            <>
              <div className="section-label" style={{justifyContent:'center', marginBottom:16}}>
                Join the first cohort
              </div>
              <h2 className="waitlist-title">Be first.<br />Get founding price. Forever.</h2>
              <p className="waitlist-sub">
                First 100 students get Base for ₦1,500 or Premium for ₦2,500 their first month — Base locks at ₦3,000/month, Premium locks at ₦4,500/month, forever.
                {spotsRemaining < 100 && ` Only ${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} remaining.`}
              </p>
              <WaitlistForm />
            </>
          ) : (
            <>
              <div className="section-label" style={{justifyContent:'center', marginBottom:16}}>
                Get started
              </div>
              <h2 className="waitlist-title">Study smarter.<br />Start today.</h2>
              <p className="waitlist-sub">
                ₦3,000/month. Cancel any time. 48-hour full refund.
              </p>
              <div style={{textAlign:'center', marginTop:24}}>
                <button className="btn btn-brand btn-lg" onClick={() => navigate('/signup')}>
                  Sign Up Now ↗
                </button>
                <p style={{fontSize:13, color:'#999', marginTop:12}}>
                  🛡️ 48-hour full refund · ~$2 USD for international students
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}