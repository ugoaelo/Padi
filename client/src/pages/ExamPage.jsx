import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { generateExam, submitExam, saveExamProgress, getIncompleteExam, getExamHistory, extractPdfText } from '../lib/aiApi.js'
import { parseFile, ACCEPTED_TYPES, ACCEPTED_LABEL } from '../lib/fileParser.js'
import './ExamPage.css'

// ── TIMER HOOK ────────────────────────────────────────────────────
function useTimer(initialSeconds, onExpire) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); onExpire?.(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const stop = () => clearInterval(intervalRef.current)

  const format = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return { seconds, formatted: format(seconds), stop, isWarning: seconds < 60 }
}

// ── SETUP SCREEN ──────────────────────────────────────────────────
function ExamSetup({ onStart, loading }) {
  const { profile } = useAuth()
  const [config, setConfig] = useState({
    topic:      '',
    subject:    profile?.course || '',
    count:      10,
    difficulty: 'medium',
    inputMode:  'topic',
    content:    '',
  })
  const [fileName,    setFileName]    = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError,   setFileError]   = useState('')
  const fileInputRef = useRef(null)

  const handleChange = (k, v) => setConfig(p => ({ ...p, [k]: v }))

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileLoading(true)
    setFileError('')
    setFileName(file.name)
    try {
      const text = await parseFile(file, extractPdfText)
      handleChange('content', text)
    } catch (err) {
      setFileError(err.message || 'Could not read file.')
      setFileName('')
    } finally {
      setFileLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="exam-setup">
      <div className="exam-setup-header">
        <h1 className="exam-title">Exam Simulation</h1>
        <p className="exam-sub">Generate a timed mock exam from any topic or your own notes. Padi scores you and identifies your weak areas.</p>
      </div>

      <div className="exam-setup-card">
        <div className="exam-setup-section">
          <div className="exam-setup-label">Input type</div>
          <div className="exam-mode-tabs">
            {[{id:'topic',label:'📝 Topic'},{id:'content',label:'📄 My Notes'}].map(m => (
              <button key={m.id} className={`exam-mode-tab ${config.inputMode===m.id?'active':''}`}
                onClick={() => { handleChange('inputMode', m.id); handleChange('content',''); setFileName('') }}>{m.label}</button>
            ))}
          </div>
        </div>

        {config.inputMode === 'topic' ? (
          <div className="exam-setup-section">
            <label className="exam-setup-label">Topic / Subject area</label>
            <input
              type="text"
              className="exam-input"
              placeholder="e.g. Organic Chemistry, Macroeconomics, Contract Law"
              value={config.topic}
              onChange={e => handleChange('topic', e.target.value)}
            />
          </div>
        ) : (
          <div className="exam-setup-section">
            <label className="exam-setup-label">Your notes or study material</label>

            {/* File upload area */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div
              className={`exam-upload-area ${fileName ? 'exam-upload-area--loaded' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              {fileLoading ? (
                <><span className="exam-upload-spinner" /><span className="exam-upload-text">Reading file...</span></>
              ) : fileName ? (
                <><span className="exam-upload-icon">✅</span><span className="exam-upload-text">{fileName}</span><span className="exam-upload-change">Click to change</span></>
              ) : (
                <><span className="exam-upload-icon">📎</span><span className="exam-upload-text">Upload a file</span><span className="exam-upload-hint">{ACCEPTED_LABEL}</span></>
              )}
            </div>
            {fileError && <p className="exam-upload-error">{fileError}</p>}

            <div className="exam-upload-divider"><span>or paste below</span></div>

            <textarea
              className="exam-textarea"
              placeholder="Paste your lecture notes, textbook content, or any study material..."
              value={config.content}
              onChange={e => { handleChange('content', e.target.value); setFileName('') }}
              rows={5}
            />
          </div>
        )}

        <div className="exam-setup-row">
          <div className="exam-setup-section">
            <label className="exam-setup-label">Subject (optional)</label>
            <input type="text" className="exam-input" placeholder="e.g. Economics"
              value={config.subject} onChange={e => handleChange('subject', e.target.value)} />
          </div>
          <div className="exam-setup-section">
            <label className="exam-setup-label">Questions</label>
            <select className="exam-select" value={config.count}
              onChange={e => handleChange('count', Number(e.target.value))}>
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <div className="exam-setup-section">
            <label className="exam-setup-label">Difficulty</label>
            <select className="exam-select" value={config.difficulty}
              onChange={e => handleChange('difficulty', e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <button
          className="btn btn-brand exam-start-btn"
          onClick={() => onStart(config)}
          disabled={loading || (!config.topic.trim() && !config.content.trim())}
        >
          {loading ? (
            <span className="exam-btn-loading"><span className="exam-spinner"/>Generating exam...</span>
          ) : '🎯 Start Exam'}
        </button>
      </div>
    </div>
  )
}

// ── EXAM SCREEN ───────────────────────────────────────────────────
function ExamScreen({ exam, sessionId, onSubmit, initialQuestionIndex = 0, initialAnswers = {} }) {
  const [answers,  setAnswers]  = useState(initialAnswers)
  const [current,  setCurrent]  = useState(initialQuestionIndex)
  const [submitting, setSubmitting] = useState(false)
  const startTime   = useRef(Date.now())
  const saveTimerRef = useRef(null)

  const { formatted, seconds, stop, isWarning } = useTimer(
    (exam.timeLimit || 30) * 60,
    () => handleSubmit(true)
  )

  const questions = exam.questions || []
  const q = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const answered = Object.keys(answers).length

  // Auto-save progress every 3 question navigations (fire-and-forget)
  const saveProgress = (nextIndex, currentAnswers, remainingSecs) => {
    if (!sessionId) return
    saveExamProgress(sessionId, {
      questionIndex:  nextIndex,
      timeRemaining:  remainingSecs,
      answers:        Object.entries(currentAnswers).map(([qId, ans]) => ({ qId, ans })),
    }).catch(() => {}) // non-fatal
  }

  const handleAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const handleSubmit = async (timeExpired = false) => {
    stop()
    setSubmitting(true)
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    try {
      const result = await submitExam({ sessionId, answers, timeTaken, questions })
      onSubmit(result)
    } catch (err) {
      console.error('Submit error:', err)
      setSubmitting(false)
    }
  }

  return (
    <div className="exam-screen">
      {/* Top bar */}
      <div className="exam-topbar">
        <div className="exam-progress-info">
          <span className="exam-q-count">Question {current + 1} of {questions.length}</span>
          <span className="exam-answered">{answered} answered</span>
        </div>
        <div className={`exam-timer ${isWarning ? 'exam-timer--warning' : ''}`}>
          ⏱ {formatted}
        </div>
      </div>

      {/* Progress bar */}
      <div className="exam-progress-bar">
        <div className="exam-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Question */}
      <div className="exam-question-card">
        <div className="exam-q-meta">
          <span className="exam-q-type">{q?.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}</span>
          <span className="exam-q-marks">{q?.marks || 1} mark{(q?.marks || 1) !== 1 ? 's' : ''}</span>
        </div>
        <div className="exam-q-text">{q?.question}</div>

        {q?.type === 'mcq' && (
          <div className="exam-options">
            {q.options?.map((opt, i) => {
              const letter = ['A','B','C','D'][i]
              return (
                <button
                  key={letter}
                  className={`exam-option ${answers[q.id] === letter ? 'selected' : ''}`}
                  onClick={() => handleAnswer(q.id, letter)}
                >
                  <span className="exam-option-letter">{letter}</span>
                  <span>{opt.replace(/^[A-D]\.\s*/, '')}</span>
                </button>
              )
            })}
          </div>
        )}

        {q?.type === 'short_answer' && (
          <textarea
            className="exam-short-answer"
            placeholder="Write your answer here..."
            value={answers[q?.id] || ''}
            onChange={e => handleAnswer(q.id, e.target.value)}
            rows={4}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="exam-nav">
        <button className="btn btn-ghost exam-nav-btn"
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}>
          ← Previous
        </button>

        <div className="exam-q-dots">
          {questions.map((_, i) => (
            <button
              key={i}
              className={`exam-q-dot ${i === current ? 'current' : ''} ${answers[questions[i]?.id] ? 'answered' : ''}`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>

        {current < questions.length - 1 ? (
          <button className="btn btn-brand exam-nav-btn"
            onClick={() => {
              const next = current + 1
              setCurrent(next)
              // Save every 3 questions to avoid excessive API calls
              if (next % 3 === 0) saveProgress(next, answers, seconds)
            }}>
            Next →
          </button>
        ) : (
          <button
            className="btn btn-brand exam-nav-btn exam-nav-btn--submit"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : `Submit (${answered}/${questions.length})`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── RESULTS SCREEN ────────────────────────────────────────────────
function ExamResults({ result, exam, onRetry, onNew }) {
  const { score, total, percentage, gradedAnswers, weakTopics, passed } = result

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}m ${sec}s`
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `🎯 Just completed an exam sim on Padi!\n\nScore: ${score}/${total} (${percentage}%)\nStatus: ${passed ? '✅ Pass' : '❌ Needs work'}\n\n_Try Padi at yourpadi.com_`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="exam-results">
      <div className="exam-results-header">
        <div className="exam-results-icon">{passed ? '🎉' : '📚'}</div>
        <h2 className="exam-results-title">
          {passed ? 'Well done!' : 'Keep studying!'}
        </h2>
        <div className="exam-results-score">
          <span className="exam-score-num">{percentage}%</span>
          <span className="exam-score-sub">{score} / {total} marks</span>
        </div>
        <div className={`exam-results-badge ${passed ? 'pass' : 'fail'}`}>
          {passed ? '✅ Pass' : '❌ Needs more study'}
        </div>
      </div>

      {/* Weak areas */}
      {weakTopics?.length > 0 && (
        <div className="exam-weak-areas">
          <div className="exam-weak-title">⚠️ Areas to review</div>
          {weakTopics.slice(0, 4).map((t, i) => (
            <div key={i} className="exam-weak-item">{t}...</div>
          ))}
        </div>
      )}

      {/* Per-question breakdown */}
      <div className="exam-breakdown">
        <div className="exam-breakdown-title">Question breakdown</div>
        {gradedAnswers?.map((a, i) => (
          <div key={i} className={`exam-breakdown-item ${a.isCorrect ? 'correct' : 'wrong'}`}>
            <div className="exam-breakdown-status">
              {a.isCorrect === true ? '✅' : a.isCorrect === false ? '❌' : `${a.score}/${a.maxScore}`}
            </div>
            <div className="exam-breakdown-detail">
              <div className="exam-breakdown-q">
                {exam?.questions?.find(q => q.id === a.questionId)?.question?.substring(0, 80)}...
              </div>
              {a.explanation && (
                <div className="exam-breakdown-explanation">{a.explanation}</div>
              )}
              {a.feedback && (
                <div className="exam-breakdown-explanation">{a.feedback}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="exam-results-actions">
        <button className="btn btn-brand" onClick={onRetry}>Retry this exam</button>
        <button className="btn btn-ghost" onClick={onNew}>New exam</button>
        <button className="btn" style={{background:'#DCF8C6',color:'#075E54',border:'none'}} onClick={handleWhatsApp}>
          📤 Share result
        </button>
      </div>

      <div className="exam-disclaimer">
        ⚠️ AI-generated exam — always verify explanations with your lecturer or textbook.
      </div>
    </div>
  )
}

// ── MAIN EXAM PAGE ────────────────────────────────────────────────
export default function ExamPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [phase,     setPhase]     = useState('setup') // setup | exam | results
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [exam,      setExam]      = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [result,    setResult]    = useState(null)
  const [lastConfig, setLastConfig] = useState(null)
  const [history,   setHistory]   = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [resumeSession, setResumeSession] = useState(null) // incomplete session to resume

  useEffect(() => {
    if (profile?.plan_tier === 'premium') {
      getExamHistory().then(r => setHistory(r.sessions || [])).catch(() => {})
      getIncompleteExam().then(r => { if (r.session) setResumeSession(r.session) }).catch(() => {})
    }
  }, [profile?.plan_tier])

  // ── Premium gate ──────────────────────────────────────────────────
  if (profile && profile.plan_tier !== 'premium') {
    return (
      <div className="exam-page">
        <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Premium feature</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Exam simulation is available on the Premium plan — timed mocks, AI grading, and full performance history.
          </p>
          <button className="exam-btn-primary" onClick={() => navigate('/pricing')}>
            Upgrade to Premium
          </button>
        </div>
      </div>
    )
  }

  const handleStart = async (config) => {
    setLoading(true)
    setError('')
    setLastConfig(config)
    try {
      const result = await generateExam({
        topic:      config.topic,
        content:    config.content,
        subject:    config.subject,
        count:      config.count,
        difficulty: config.difficulty,
      })
      setExam(result.data)
      setSessionId(result.sessionId)
      setPhase('exam')
    } catch (err) {
      setError(err.message || 'Failed to generate exam. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (examResult) => {
    setResult(examResult)
    setPhase('results')
  }

  const handleRetry = () => {
    setResult(null)
    setPhase('exam')
  }

  const handleNew = () => {
    setExam(null)
    setSessionId(null)
    setResult(null)
    setPhase('setup')
  }

  const handleResume = () => {
    if (!resumeSession) return
    // Restore exam state from the saved session
    setExam({ questions: resumeSession.questions, timeLimit: Math.ceil((resumeSession.time_remaining || 0) / 60) })
    setSessionId(resumeSession.id)
    setPhase('exam')
    setResumeSession(null)
  }

  return (
    <div className="exam-page">
      {error && <div className="exam-error">{error}</div>}

      {phase === 'setup' && (
        <>
          {/* Resume card — shown when there's an incomplete session */}
          {resumeSession && (
            <div className="exam-resume-card">
              <div className="exam-resume-icon">⏸</div>
              <div className="exam-resume-info">
                <div className="exam-resume-title">Unfinished exam: {resumeSession.topic}</div>
                <div className="exam-resume-meta">
                  Question {(resumeSession.question_index || 0) + 1} of {resumeSession.total}
                  {resumeSession.time_remaining != null && (
                    <> · {Math.ceil(resumeSession.time_remaining / 60)} min left</>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-brand" style={{ padding: '8px 16px', fontSize: 13 }} onClick={handleResume}>
                  Resume →
                </button>
                <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 13 }}
                  onClick={() => setResumeSession(null)} title="Dismiss">✕</button>
              </div>
            </div>
          )}

          <ExamSetup onStart={handleStart} loading={loading} />

          {/* History */}
          {history.length > 0 && (
            <div className="exam-history">
              <button
                className="exam-history-toggle"
                onClick={() => setShowHistory(!showHistory)}
              >
                📋 Recent exams ({history.length}) {showHistory ? '▲' : '▼'}
              </button>
              {showHistory && (
                <div className="exam-history-list">
                  {history.slice(0, 5).map(session => (
                    <div key={session.id} className="exam-history-item">
                      <div className="exam-history-topic">{session.topic}</div>
                      <div className="exam-history-meta">
                        <span className={`exam-history-score ${(session.score/session.total*100) >= 50 ? 'pass' : 'fail'}`}>
                          {Math.round(session.score/session.total*100)}%
                        </span>
                        <span>{session.score}/{session.total}</span>
                        <span>{new Date(session.completed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {phase === 'exam' && exam && (
        <ExamScreen
          exam={exam}
          sessionId={sessionId}
          onSubmit={handleSubmit}
          initialQuestionIndex={resumeSession?.question_index || 0}
          initialAnswers={
            // Convert saved [{qId, ans}] array back to {qId: ans} map
            Array.isArray(resumeSession?.answers)
              ? Object.fromEntries((resumeSession.answers).map(a => [a.qId, a.ans]))
              : {}
          }
        />
      )}

      {phase === 'results' && result && (
        <ExamResults result={result} exam={exam} onRetry={handleRetry} onNew={handleNew} />
      )}
    </div>
  )
}
