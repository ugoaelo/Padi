import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { explainTopic, solveMath, refineAnswer, flagAnswer, saveToLibrary } from '../lib/aiApi.js'
import './AskPage.css'

const SUGGESTED = ['Explain supply and demand','What is photosynthesis?','Define opportunity cost','How does the heart work?','Explain Newton\'s laws of motion','What is the rule of law?']

function AIResponseCard({ question, answer, type, webSearched, webSearchLimit, onRefine }) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [flagged, setFlagged] = useState(false)
  const [showRefine, setShowRefine] = useState(false)
  const [showFlag,   setShowFlag]   = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [flagReason,  setFlagReason]  = useState('')

  const handleSave = async () => {
    setSaving(true)
    try { await saveToLibrary({ itemType: type, title: question.substring(0,80), content: { question, answer } }); setSaved(true) }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const handleFlag = async () => {
    if (!flagReason.trim()) return
    try { await flagAnswer({ question, answer, reason: flagReason }); setFlagged(true); setShowFlag(false) }
    catch (e) { console.error(e) }
  }

  const renderMd = (text) => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*?)$/gm,'<h3>$1</h3>').replace(/^## (.*?)$/gm,'<h2>$1</h2>')
    .replace(/^- (.*?)$/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>')

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <div className="ai-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg></div>
        <span className="ai-label">Padi</span>
        <span className="ai-type-badge">{type}</span>
        {webSearched    && <span className="ai-web-badge">🌐 Web</span>}
        {webSearchLimit && <span className="ai-web-badge" style={{ background: '#FEF3C7', color: '#92400E' }} title="Daily web search limit reached">🌐 Limit reached</span>}
      </div>
      <div className="ai-content" dangerouslySetInnerHTML={{ __html: renderMd(answer) }} />
      <div className="ai-disclaimer">⚠️ AI-generated — always verify with your lecturer or textbook.</div>
      <div className="ai-actions">
        <button className={`ai-btn ${saved?'ai-btn--done':'ai-btn--green'}`} onClick={handleSave} disabled={saving||saved}>{saved?'✓ Saved':saving?'Saving...':'💾 Save'}</button>
        <button className="ai-btn" onClick={()=>setShowRefine(!showRefine)}>✏️ Refine</button>
        <button className={`ai-btn ${flagged?'ai-btn--flagged':''}`} onClick={()=>!flagged&&setShowFlag(!showFlag)} disabled={flagged}>{flagged?'✓ Flagged':'🚩 Flag'}</button>
      </div>
      {showRefine && (
        <div className="ai-refine-row">
          <input className="ai-refine-input" placeholder='"Simplify this", "Make quiz", "Focus on mitosis only"...' value={refineInput} onChange={e=>setRefineInput(e.target.value)} autoFocus onKeyDown={e=>{if(e.key==='Enter'){onRefine?.(refineInput);setRefineInput('');setShowRefine(false)}}} />
          <button className="btn btn-brand" style={{padding:'10px 16px',fontSize:13}} onClick={()=>{onRefine?.(refineInput);setRefineInput('');setShowRefine(false)}}>Refine →</button>
        </div>
      )}
      {showFlag && (
        <div className="ai-refine-row" style={{flexDirection:'column',gap:8}}>
          <p style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>What's wrong with this answer?</p>
          <input className="ai-refine-input" placeholder="e.g. Wrong formula, outdated info..." value={flagReason} onChange={e=>setFlagReason(e.target.value)} autoFocus />
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-brand" style={{padding:'8px 14px',fontSize:13}} onClick={handleFlag} disabled={!flagReason.trim()}>Submit</button>
            <button className="btn btn-ghost" style={{padding:'8px 14px',fontSize:13}} onClick={()=>setShowFlag(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AskPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [input,      setInput]      = useState('')
  const [mode,       setMode]       = useState('topic')
  const [subject,    setSubject]    = useState(profile?.course || '')
  const [webSearch,  setWebSearch]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [messages,   setMessages]   = useState([])
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const handleSubmit = async (e, override) => {
    e?.preventDefault()
    const question = (override || input).trim()
    if (!question) return
    setLoading(true); setError(''); setInput('')
    try {
      const result = mode === 'math'
        ? await solveMath({ problem: question, subject })
        : await explainTopic({ topic: question, subject, useWebSearch: webSearch && mode !== 'math' })
      setMessages(prev => [...prev, {
        question,
        answer:         result.response,
        type:           mode === 'math' ? 'math' : 'explanation',
        webSearched:    result.webSearchUsed || false,
        webSearchLimit: result.webSearchLimitReached || false,
      }])
    } catch (err) { setError(err.message || 'Failed to get answer. Please try again.') }
    finally { setLoading(false) }
  }

  const handleRefine = async (msg, req) => {
    setLoading(true); setError('')
    try {
      const result = await refineAnswer({ originalAnswer: msg.answer, refinementRequest: req, context: msg.question })
      setMessages(prev => [...prev, { question: `Refinement: "${req}"`, answer: result.response, type: 'refinement' }])
    } catch (err) { setError(err.message || 'Refinement failed.') }
    finally { setLoading(false) }
  }

  // Proactive gate — Base subscribers see an upgrade prompt instead of the form
  if (profile && profile.plan_tier !== 'premium') {
    return (
      <div className="ask-page">
        <div className="ask-header">
          <h1 className="ask-title">Ask Padi</h1>
          <p className="ask-sub">Instant answers to any question — available on Premium.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>This is a Premium feature</h2>
          <p style={{ color: 'var(--ink-light)', marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            Ask Padi, step-by-step maths, and answer refinement are available on the Premium plan.
          </p>
          <button className="btn btn-brand" onClick={() => navigate('/pricing')}>
            Upgrade to Premium ↗
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ask-page">
      <div className="ask-header">
        <h1 className="ask-title">Ask Padi</h1>
        <p className="ask-sub">Ask any question from your course. Get clear, cited explanations instantly.</p>
      </div>
      <div className="ask-mode-tabs">
        {[{id:'topic',label:'📝 Topic / Question'},{id:'math',label:'📐 Maths Problem'}].map(m => (
          <button key={m.id} className={`ask-mode-tab ${mode===m.id?'active':''}`} onClick={()=>setMode(m.id)}>{m.label}</button>
        ))}
      </div>
      {messages.length === 0 && !loading && (
        <div className="ask-empty">
          <div className="ask-empty-icon">💬</div>
          <div className="ask-empty-title">What do you want to understand today?</div>
          <div className="ask-suggestions">
            {SUGGESTED.map(s => <button key={s} className="ask-suggestion" onClick={()=>handleSubmit(null,s)}>{s}</button>)}
          </div>
        </div>
      )}
      <div className="ask-messages">
        {messages.map((msg, i) => (
          <div key={i} className="ask-message-group">
            <div className="ask-question-bubble">
              <div className="ask-q-avatar">{profile?.full_name?.[0]?.toUpperCase()||'S'}</div>
              <div className="ask-question-text">{msg.question}</div>
            </div>
            <AIResponseCard question={msg.question} answer={msg.answer} type={msg.type} webSearched={msg.webSearched} webSearchLimit={msg.webSearchLimit} onRefine={req=>handleRefine(msg,req)} />
          </div>
        ))}
        {loading && (
          <div className="ask-loading">
            <div className="ask-loading-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg></div>
            <div className="ask-loading-dots"><span/><span/><span/></div>
          </div>
        )}
        {error && <div className="ask-error">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form className="ask-form" onSubmit={handleSubmit}>
        <div className="ask-form-top-row">
          <input type="text" className="ask-subject-input" placeholder="Subject (optional)" value={subject} onChange={e=>setSubject(e.target.value)} />
          {mode !== 'math' && (
            <button
              type="button"
              className={`ask-web-toggle ${webSearch ? 'ask-web-toggle--on' : ''}`}
              onClick={() => setWebSearch(w => !w)}
              title={webSearch ? 'Web search ON — results will enrich the answer' : 'Web search OFF — click to enable'}
            >
              🌐 {webSearch ? 'Web: On' : 'Web: Off'}
            </button>
          )}
        </div>
        <div className="ask-input-main">
          <textarea className="ask-textarea" placeholder={mode==='math'?'Type your maths problem here...':'Ask any question or type a topic to explain...'} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSubmit(e)}}} rows={3} />
          <button type="submit" className="ask-send-btn" disabled={loading||!input.trim()}>
            {loading ? <div className="ask-send-spinner"/> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
          </button>
        </div>
        <div className="ask-input-hint">Press Enter to send · Shift+Enter for new line{webSearch && <span className="ask-web-hint"> · 🌐 Web search active</span>}</div>
      </form>
    </div>
  )
}
