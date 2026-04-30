import { useState, useEffect } from 'react'
import { analysePastQuestions, predictQuestions, extractPdfText } from '../lib/aiApi.js'
import { parseFile, ACCEPTED_TYPES, ACCEPTED_LABEL } from '../lib/fileParser.js'
import './PastQuestionsPage.css'

const SESSION_KEY_ANALYSIS  = 'padi_pastq_analysis'
const SESSION_KEY_PREDICTED = 'padi_pastq_predicted'
const SESSION_KEY_SUBJECT   = 'padi_pastq_subject'
 
const LIKELIHOOD_COLORS = {
  'Very High': { bg: '#D1FAE5', text: '#065F46' },
  'High':      { bg: '#EEF2FF', text: '#3730A3' },
  'Medium':    { bg: '#FEF3C7', text: '#92400E' },
  'Low':       { bg: '#F3F4F6', text: '#6B7280' },
}

export default function PastQuestionsPage() {
  const [tab,         setTab]         = useState('analyse')
  const [content,     setContent]     = useState('')
  const [subject,     setSubject]     = useState(
    () => sessionStorage.getItem(SESSION_KEY_SUBJECT) || ''
  )
  const [file,        setFile]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [analysis,    setAnalysis]    = useState(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY_ANALYSIS)
      return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const [predicted,   setPredicted]   = useState(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY_PREDICTED)
      return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const [generating,  setGenerating]  = useState(false)

  // Restore to results tab if we have a cached analysis
  useEffect(() => {
    if (analysis && tab === 'analyse') setTab('results')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  

const handleFileUpload = async (e) => {
  const f = e.target.files[0]
  if (!f) return
  setFile(f)
  setError('')
  try {
    const text = await parseFile(f, extractPdfText)
    setContent(text)          // ← was setInput (bug fix)
  } catch (err) {
    setError(err.message || 'Could not read file.')
    setFile(null)
  } finally {
    e.target.value = ''
  }
}

  const handleAnalyse = async (e) => {
    e.preventDefault()
    if (!content.trim()) { setError('Please upload or paste your tutorial/past questions.'); return }
    setLoading(true)
    setError('')
    setAnalysis(null)
    setPredicted(null)

    try {
      const result = await analysePastQuestions({ content, subject })
      setAnalysis(result.data)
      try {
        sessionStorage.setItem(SESSION_KEY_ANALYSIS, JSON.stringify(result.data))
        sessionStorage.setItem(SESSION_KEY_SUBJECT,  subject)
        sessionStorage.removeItem(SESSION_KEY_PREDICTED) // stale predicted from old analysis
      } catch { /* storage full — non-fatal */ }
    } catch (err) {
      setError(err.message || 'Failed to analyse past questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePredicted = async () => {
    if (!analysis?.predictedTopics?.length) return
    setGenerating(true)
    try {
      const result = await predictQuestions({
        predictedTopics: analysis.predictedTopics,
        subject,
        count: 8,
      })
      setPredicted(result.data)
      try { sessionStorage.setItem(SESSION_KEY_PREDICTED, JSON.stringify(result.data)) } catch { /* non-fatal */ }
      setTab('predicted')
    } catch (err) {
      setError(err.message || 'Failed to generate predicted questions.')
    } finally {
      setGenerating(false)
    }
  }

  const handleWhatsApp = () => {
    if (!analysis) return
    const topTopics = analysis.topicFrequency?.slice(0, 3).map(t => t.topic).join(', ')
    const text = encodeURIComponent(
      `🔮 *Tutorial Question Analysis — Padi*\n\nTop topics: ${topTopics}\n\n_Analysed with Padi — yourpadi.com_`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="pastq-page">
      <div className="pastq-header">
        <h1 className="pastq-title">Tutorial Question Intelligence</h1>
        <p className="pastq-sub">Upload tutorial or past exam papers. Padi detects patterns, predicts topics, and generates targeted practice questions.</p>
      </div>

      {/* Tabs */}
      <div className="pastq-tabs">
        <button className={`pastq-tab ${tab==='analyse'?'active':''}`} onClick={()=>setTab('analyse')}>
          📄 Upload & Analyse
        </button>
        {analysis && (
          <button className={`pastq-tab ${tab==='results'?'active':''}`} onClick={()=>setTab('results')}>
            📊 Analysis Results
          </button>
        )}
        {predicted && (
          <button className={`pastq-tab ${tab==='predicted'?'active':''}`} onClick={()=>setTab('predicted')}>
            🔮 Predicted Questions
          </button>
        )}
      </div>

      {/* Upload tab */}
      {tab === 'analyse' && (
        <div className="pastq-upload-section">
          <form className="pastq-form" onSubmit={handleAnalyse}>
            <div className="pastq-upload-area">
              <input type="file" id="pastq-file" accept={ACCEPTED_TYPES}
                onChange={handleFileUpload} style={{display:'none'}} />
              <label htmlFor="pastq-file" className="pastq-upload-label">
                {file ? (
                  <>
                    <span className="pastq-upload-icon">✅</span>
                    <span className="pastq-upload-filename">{file.name}</span>
                    <span className="pastq-upload-change">Click to change file</span>
                  </>
                ) : (
                  <>
                    <span className="pastq-upload-icon">📄</span>
                    <span className="pastq-upload-title">Upload past exam papers</span>
                    <span className="pastq-upload-hint">{ACCEPTED_LABEL} — multiple years recommended</span>
                  </>
                )}
              </label>
            </div>

            <div className="pastq-divider"><span>or paste directly</span></div>

            <textarea
              className="pastq-textarea"
              placeholder="Paste your past exam questions here. The more years you include, the better the pattern detection..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
            />

            <input type="text" className="pastq-input"
              placeholder="Subject / Course (optional)"
              value={subject} onChange={e => { setSubject(e.target.value); try { sessionStorage.setItem(SESSION_KEY_SUBJECT, e.target.value) } catch {} }} />

            {error && <div className="pastq-error">{error}</div>}

            <div className="pastq-privacy">
              🔒 Your documents are used only to generate analysis and are not stored permanently.
            </div>

            <button type="submit" className="btn btn-brand pastq-analyse-btn" disabled={loading}>
              {loading ? (
                <span className="pastq-btn-loading"><span className="pastq-spinner"/>Analysing patterns...</span>
              ) : '🔍 Analyse Tutorial Questions'}
            </button>
          </form>

          {analysis && (
            <div className="pastq-analysis-ready">
              ✅ Analysis complete!
              <button className="btn btn-ghost" style={{padding:'8px 16px',fontSize:13}} onClick={()=>setTab('results')}>
                View results →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analysis results tab */}
      {tab === 'results' && analysis && (
        <div className="pastq-results">
          {/* Summary */}
          <div className="pastq-summary-row">
            <div className="pastq-summary-card">
              <div className="pastq-summary-num">{analysis.totalQuestions || '—'}</div>
              <div className="pastq-summary-label">Questions analysed</div>
            </div>
            <div className="pastq-summary-card">
              <div className="pastq-summary-num">{analysis.topicFrequency?.length || '—'}</div>
              <div className="pastq-summary-label">Topics identified</div>
            </div>
            <div className="pastq-summary-card">
              <div className="pastq-summary-num">{analysis.predictedTopics?.length || '—'}</div>
              <div className="pastq-summary-label">Topics predicted</div>
            </div>
          </div>

          {/* Topic frequency */}
          <div className="pastq-section">
            <div className="pastq-section-title">📊 Topic frequency</div>
            <div className="pastq-topic-list">
              {analysis.topicFrequency?.map((t, i) => {
                const colors = LIKELIHOOD_COLORS[t.likelihood] || LIKELIHOOD_COLORS['Low']
                return (
                  <div key={i} className="pastq-topic-item">
                    <div className="pastq-topic-rank">#{i+1}</div>
                    <div className="pastq-topic-info">
                      <div className="pastq-topic-name">{t.topic}</div>
                      <div className="pastq-topic-bar-wrap">
                        <div className="pastq-topic-bar" style={{width:`${t.percentage}%`}} />
                      </div>
                    </div>
                    <div className="pastq-topic-meta">
                      <span className="pastq-topic-count">{t.count}x</span>
                      <span className="pastq-topic-likelihood" style={{background:colors.bg,color:colors.text}}>
                        {t.likelihood}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Predicted topics */}
          <div className="pastq-section">
            <div className="pastq-section-title">🔮 Predicted exam topics</div>
            <div className="pastq-predicted-list">
              {analysis.predictedTopics?.map((t, i) => {
                const colors = LIKELIHOOD_COLORS[t.likelihood] || LIKELIHOOD_COLORS['Low']
                return (
                  <div key={i} className="pastq-predicted-item">
                    <div className="pastq-predicted-header">
                      <span className="pastq-predicted-topic">{t.topic}</span>
                      <span className="pastq-likelihood-badge" style={{background:colors.bg,color:colors.text}}>
                        {t.likelihood}
                      </span>
                    </div>
                    <p className="pastq-predicted-reason">{t.reasoning}</p>
                    {t.suggestedStudyTime && (
                      <span className="pastq-study-time">⏱ {t.suggestedStudyTime}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Patterns */}
          {analysis.examPatterns?.length > 0 && (
            <div className="pastq-section">
              <div className="pastq-section-title">🔍 Exam patterns detected</div>
              <div className="pastq-patterns">
                {analysis.examPatterns.map((p, i) => (
                  <div key={i} className="pastq-pattern-item">📌 {p}</div>
                ))}
              </div>
            </div>
          )}

          {/* Study recommendations */}
          {analysis.studyRecommendations?.length > 0 && (
            <div className="pastq-section">
              <div className="pastq-section-title">📚 Study recommendations</div>
              <div className="pastq-recommendations">
                {analysis.studyRecommendations.map((r, i) => (
                  <div key={i} className="pastq-recommendation-item">✓ {r}</div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pastq-actions">
            <button
              className="btn btn-brand"
              onClick={handleGeneratePredicted}
              disabled={generating}
            >
              {generating ? (
                <span className="pastq-btn-loading"><span className="pastq-spinner"/>Generating...</span>
              ) : '🔮 Generate predicted questions'}
            </button>
            <button className="btn" style={{background:'#DCF8C6',color:'#075E54',border:'none'}} onClick={handleWhatsApp}>
              📤 Share analysis
            </button>
          </div>

          <div className="pastq-disclaimer">
            ⚠️ AI predictions are based on pattern analysis and are not guaranteed. Always study all topics thoroughly.
          </div>
        </div>
      )}

      {/* Predicted questions tab */}
      {tab === 'predicted' && predicted && (
        <div className="pastq-predicted-questions">
          <div className="pastq-pq-header">
            <h2 className="pastq-pq-title">Predicted exam questions</h2>
            <p className="pastq-pq-sub">Generated based on topic frequency analysis. Practice these to prepare for high-likelihood areas.</p>
          </div>
          {predicted.questions?.map((q, i) => {
            const colors = LIKELIHOOD_COLORS[q.likelihood] || LIKELIHOOD_COLORS['Medium']
            return (
              <div key={i} className="pastq-pq-item">
                <div className="pastq-pq-item-header">
                  <span className="pastq-pq-topic">{q.topic}</span>
                  <span className="pastq-pq-likelihood" style={{background:colors.bg,color:colors.text}}>
                    {q.likelihood}
                  </span>
                  <span className="pastq-pq-type">{q.type}</span>
                  <span className="pastq-pq-marks">{q.marks} mark{q.marks!==1?'s':''}</span>
                </div>
                <div className="pastq-pq-question">{q.question}</div>
                {q.options && (
                  <div className="pastq-pq-options">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`pastq-pq-option ${q.correct === ['A','B','C','D'][j] ? 'correct' : ''}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
                {q.sampleAnswer && (
                  <details className="pastq-pq-answer">
                    <summary>View sample answer</summary>
                    <p>{q.sampleAnswer}</p>
                  </details>
                )}
              </div>
            )
          })}
          <div className="pastq-disclaimer">
            ⚠️ AI-generated predictions — not a substitute for thorough study of all course material.
          </div>
        </div>
      )}
    </div>
  )
}
