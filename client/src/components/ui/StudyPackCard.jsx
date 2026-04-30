import { useState } from 'react'
import { saveToLibrary } from '../../lib/aiApi.js'
import './StudyPackCard.css'

export default function StudyPackCard({ pack, onReload }) {
  const [activeTab, setActiveTab] = useState('notes')
  const [quizIndex, setQuizIndex] = useState(0)
  const [selected,  setSelected]  = useState(null)
  const [revealed,  setRevealed]  = useState(false)
  const [flipped,   setFlipped]   = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  if (!pack) return null

  const {
    title      = 'Study Pack',
    summary    = '',
    notes      = '',
    flashcards = [],
    citations  = [],
    citation   = '',
  } = pack

  // Normalise field names — AI may return keyPoints or keyConcepts
  const keyConcepts = pack.keyConcepts || pack.keyPoints || []

  // Normalise quiz — AI may return correct or answer
  const quiz = (pack.quiz || []).map(q => ({
    ...q,
    correct: q.correct || q.answer || '',
  }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveToLibrary({ itemType: 'study_pack', title, content: pack })
      setSaved(true)
      onReload?.()
    } catch (err) { console.error('Save error:', err) }
    finally { setSaving(false) }
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`📦 *Study Pack: ${title}*\n\n${summary}\n\n_Generated with Padi — yourpadi.com_`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const currentCard = flashcards[cardIndex]
  const currentQ    = quiz[quizIndex]
  const isCorrect   = selected === currentQ?.correct

  const renderMarkdown = (text) => (text || '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')

  const allCitations = citations.length > 0 ? citations : (citation ? [citation] : [])

  return (
    <div className="pack-card">
      <div className="pack-card-header">
        <div>
          <div className="pack-card-label">Study Pack</div>
          <h2 className="pack-card-title">{title}</h2>
          {summary && <p className="pack-card-summary">{summary}</p>}
        </div>
        <div className="pack-card-actions">
          <button className={`pack-action-btn ${saved?'pack-action-btn--done':'pack-action-btn--green'}`} onClick={handleSave} disabled={saving||saved}>
            {saved?'✓ Saved':saving?'Saving...':'💾 Save'}
          </button>
          <button className="pack-action-btn pack-action-btn--whatsapp" onClick={handleWhatsApp}>📤 Share</button>
        </div>
      </div>

      <div className="pack-stats">
        <div className="pack-stat"><span className="pack-stat-num">{keyConcepts.length}</span><span className="pack-stat-label">Concepts</span></div>
        <div className="pack-stat"><span className="pack-stat-num">{flashcards.length}</span><span className="pack-stat-label">Flashcards</span></div>
        <div className="pack-stat"><span className="pack-stat-num">{quiz.length}</span><span className="pack-stat-label">Quiz Qs</span></div>
      </div>

      <div className="pack-tabs">
        {[{id:'notes',label:'📄 Notes'},{id:'concepts',label:'🔑 Key Concepts'},{id:'flashcards',label:'🃏 Flashcards'},{id:'quiz',label:'✏️ Quiz'}].map(t => (
          <button key={t.id} className={`pack-tab ${activeTab===t.id?'active':''}`} onClick={()=>setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="pack-content">
        {activeTab === 'notes' && (
          <div className="pack-notes" dangerouslySetInnerHTML={{ __html: renderMarkdown(notes || summary) }} />
        )}

        {activeTab === 'concepts' && (
          <div className="pack-concepts">
            {keyConcepts.length === 0 ? <p className="pack-empty-tab">No key concepts extracted.</p>
            : keyConcepts.map((c, i) => (
              <div key={i} className="pack-concept-item">
                <div className="pack-concept-term">{c.term || c}</div>
                {c.definition && <div className="pack-concept-def">{c.definition}</div>}
                {c.example && <div className="pack-concept-example"><span>Example: </span>{c.example}</div>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="pack-flashcards">
            {flashcards.length === 0 ? <p className="pack-empty-tab">No flashcards generated.</p> : (
              <>
                <div className="pack-card-counter">Card {cardIndex+1} of {flashcards.length}</div>
                <div className={`pack-flashcard ${flipped?'flipped':''}`} onClick={()=>setFlipped(!flipped)}>
                  <div className="pack-flashcard-inner">
                    <div className="pack-flashcard-front">
                      <div className="pack-flashcard-side-label">Question</div>
                      <div className="pack-flashcard-text">{currentCard?.front}</div>
                      <div className="pack-flashcard-hint">Tap to reveal answer</div>
                    </div>
                    <div className="pack-flashcard-back">
                      <div className="pack-flashcard-side-label">Answer</div>
                      <div className="pack-flashcard-text">{currentCard?.back}</div>
                    </div>
                  </div>
                </div>
                <div className="pack-flashcard-nav">
                  <button className="pack-nav-btn" onClick={()=>{setCardIndex(Math.max(0,cardIndex-1));setFlipped(false)}} disabled={cardIndex===0}>← Prev</button>
                  <button className="pack-nav-btn" onClick={()=>{setCardIndex(Math.min(flashcards.length-1,cardIndex+1));setFlipped(false)}} disabled={cardIndex===flashcards.length-1}>Next →</button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="pack-quiz">
            {quiz.length === 0 ? <p className="pack-empty-tab">No quiz questions generated.</p>
            : quizIndex >= quiz.length ? (
              <div className="pack-quiz-done">
                <div style={{fontSize:44,marginBottom:12}}>🎉</div>
                <h3>Quiz complete!</h3>
                <p>You answered all {quiz.length} questions.</p>
                <button className="btn btn-brand" onClick={()=>{setQuizIndex(0);setSelected(null);setRevealed(false)}}>Restart quiz</button>
              </div>
            ) : (
              <>
                <div className="pack-quiz-counter">Question {quizIndex+1} of {quiz.length}</div>
                <div className="pack-quiz-question">{currentQ?.question}</div>
                <div className="pack-quiz-options">
                  {currentQ?.options?.map((opt, i) => {
                    const letter = ['A','B','C','D'][i]
                    const isSelected   = selected === letter
                    const isCorrectOpt = letter === currentQ.correct
                    let optClass = 'pack-quiz-option'
                    if (revealed) { if (isCorrectOpt) optClass += ' correct'; else if (isSelected) optClass += ' wrong' }
                    else if (isSelected) optClass += ' selected'
                    return (
                      <button key={letter} className={optClass} onClick={()=>!revealed&&setSelected(letter)} disabled={revealed}>
                        <span className="pack-quiz-option-letter">{letter}</span>
                        {typeof opt === 'string' ? opt.replace(/^[A-D]\.\s*/,'') : opt}
                      </button>
                    )
                  })}
                </div>
                {selected && !revealed && (
                  <button className="btn btn-brand pack-quiz-reveal" onClick={()=>setRevealed(true)}>Check answer</button>
                )}
                {revealed && (
                  <>
                    <div className={`pack-quiz-result ${isCorrect?'correct':'wrong'}`}>
                      {isCorrect ? '✅ Correct!' : `❌ The correct answer is ${currentQ?.correct}`}
                      {currentQ?.explanation && <p className="pack-quiz-explanation">{currentQ.explanation}</p>}
                    </div>
                    <button className="btn btn-brand pack-quiz-next"
                      onClick={()=>{setQuizIndex(quizIndex+1);setSelected(null);setRevealed(false)}}>
                      {quizIndex+1 < quiz.length ? 'Next question →' : 'Finish quiz'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {allCitations.length > 0 && (
        <div className="pack-citations">
          <div className="pack-citations-label">📎 Sources</div>
          {allCitations.map((c,i) => <div key={i} className="pack-citation">{c}</div>)}
        </div>
      )}

      <div className="pack-disclaimer">⚠️ AI-generated content — always verify with your lecturer or textbook.</div>
    </div>
  )
}
