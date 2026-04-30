import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { generatePack, summariseNotes, extractPdfText, deleteStudyPack } from '../lib/aiApi.js'
import { parseFile, ACCEPTED_TYPES, ACCEPTED_LABEL } from '../lib/fileParser.js'
import { supabase } from '../lib/supabase.js'
import StudyPackCard from '../components/ui/StudyPackCard.jsx'
import './StudyPacksPage.css'

const INPUT_MODES = [
  { id: 'topic',    label: '📝 Topic',        placeholder: "e.g. Photosynthesis, Newton's Laws, Supply & Demand" },
  { id: 'document', label: '📄 Upload Notes', placeholder: 'Paste your lecture notes or text here...' },
  { id: 'paste',    label: '✂️ Paste Text',   placeholder: 'Paste any text — notes, slides, textbook excerpts...' },
]

export default function StudyPacksPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [mode,       setMode]       = useState('topic')
  const [input,      setInput]      = useState('')
  const [subject,    setSubject]    = useState(profile?.course || '')
  const [file,       setFile]       = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [activePack, setActivePack] = useState(null)
  const [myPacks,    setMyPacks]    = useState([])
  const [tab,        setTab]        = useState('generate')
  const [deleting,   setDeleting]   = useState(null) // pack id being deleted

  const MAX_PACKS = 30

  useEffect(() => { loadMyPacks() }, [])

  const loadMyPacks = async () => {
    const { data } = await supabase.from('study_packs').select('*').order('created_at', { ascending: false }).limit(MAX_PACKS)
    if (data) setMyPacks(data)
  }



  const handleFileUpload = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setError('')
    try {
      const text = await parseFile(f, extractPdfText)
      setInput(text)
    } catch (err) {
      setError(err.message || 'Could not read file.')
      setFile(null)
    } finally {
      e.target.value = ''
    }
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!input.trim() && mode !== 'document') { setError('Please enter a topic or paste some content.'); return }
    setLoading(true); setError(''); setActivePack(null)
    try {
      const result = await generatePack({
        topic:   mode === 'topic' ? input : undefined,
        content: mode !== 'topic' ? input : undefined,
        subject,
      })
      // Route returns { pack, fromCache } — pack has the study pack content
      if (result.pack) {
        setActivePack(result.pack.content ? { ...result.pack.content, packId: result.pack.id } : result.pack)
        await loadMyPacks()
      } else {
        setError('Failed to generate study pack. Please try again.')
      }
    } catch (err) {
      if (err.message?.includes('PACK_LIMIT_REACHED') || err.code === 'PACK_LIMIT_REACHED') {
        setError(`You've reached the ${MAX_PACKS}-pack limit. Delete older packs from the My Packs tab to create new ones.`)
      } else {
        setError(err.message || 'Failed to generate study pack. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (packId, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this study pack? This cannot be undone.')) return
    setDeleting(packId)
    try {
      await deleteStudyPack(packId)
      setMyPacks(prev => prev.filter(p => p.id !== packId))
      if (activePack?.packId === packId) setActivePack(null)
    } catch (err) {
      setError(err.message || 'Failed to delete pack.')
    } finally {
      setDeleting(null)
    }
  }

  // Proactive gate — Base subscribers see an upgrade prompt instead of the form
  if (profile && profile.plan_tier !== 'premium') {
    return (
      <div className="packs-page">
        <div className="packs-header">
          <h1 className="packs-title">Study Packs</h1>
          <p className="packs-sub">Turn any topic or notes into a full study package — available on Premium.</p>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>This is a Premium feature</h2>
          <p style={{ color: 'var(--ink-light)', marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
            Study packs, flashcards, quizzes, and document summarisation are available on the Premium plan.
          </p>
          <button className="btn btn-brand" onClick={() => navigate('/pricing')}>
            Upgrade to Premium ↗
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="packs-page">
      <div className="packs-header">
        <h1 className="packs-title">Study Packs</h1>
        <p className="packs-sub">Turn any topic, notes, or document into a complete study package — instantly.</p>
      </div>

      <div className="packs-tabs">
        <button className={`packs-tab ${tab==='generate'?'active':''}`} onClick={()=>setTab('generate')}>✨ Generate Pack</button>
        <button className={`packs-tab ${tab==='my-packs'?'active':''}`} onClick={()=>setTab('my-packs')}>📚 My Packs ({myPacks.length})</button>
      </div>

      {tab === 'generate' && (
        <div className="packs-generate">
          <div className="packs-mode-row">
            {INPUT_MODES.map(m => (
              <button key={m.id} className={`packs-mode-btn ${mode===m.id?'active':''}`}
                onClick={()=>{setMode(m.id);setInput('');setFile(null)}}>{m.label}</button>
            ))}
          </div>

          <form className="packs-form" onSubmit={handleGenerate}>
            <div className="packs-form-row">
              <input type="text" className="packs-subject-input" placeholder="Subject (optional)"
                value={subject} onChange={e=>setSubject(e.target.value)} />
            </div>

            {mode === 'document' ? (
              <div className="packs-upload-area">
                <input type="file" id="pack-file-upload" accept={ACCEPTED_TYPES}
                  onChange={handleFileUpload} style={{display:'none'}} />
                <label htmlFor="pack-file-upload" className="packs-upload-label">
                  {file ? (
                    <><span className="packs-upload-icon">✅</span><span className="packs-upload-filename">{file.name}</span><span className="packs-upload-change">Click to change</span></>
                  ) : (
                    <><span className="packs-upload-icon">📄</span><span className="packs-upload-title">Upload your notes</span><span className="packs-upload-hint">{ACCEPTED_LABEL}</span></>
                  )}
                </label>
                <p className="packs-privacy-note">🔒 Your documents are used only to generate your study pack and are not stored permanently.</p>
              </div>
            ) : (
              <textarea className="packs-textarea"
                placeholder={INPUT_MODES.find(m2=>m2.id===mode)?.placeholder}
                value={input} onChange={e=>setInput(e.target.value)}
                rows={mode==='topic'?2:6} />
            )}

            {error && <div className="packs-error">{error}</div>}

            <button type="submit" className="btn btn-brand packs-generate-btn" disabled={loading}>
              {loading ? <span className="packs-btn-loading"><span className="packs-spinner"/>Generating your study pack...</span> : '✨ Generate Study Pack'}
            </button>
          </form>

          {activePack && <div className="packs-result"><StudyPackCard pack={activePack} onReload={loadMyPacks} /></div>}
        </div>
      )}

      {tab === 'my-packs' && (
        <div className="packs-list">
          {myPacks.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {myPacks.length} / {MAX_PACKS} packs used
              </span>
              {myPacks.length >= MAX_PACKS && (
                <span style={{ fontSize: 12, color: 'var(--color-text-danger, #DC2626)', fontWeight: 500 }}>
                  Limit reached — delete a pack to create new ones
                </span>
              )}
            </div>
          )}
          {myPacks.length === 0 ? (
            <div className="packs-empty">
              <div className="packs-empty-icon">📦</div>
              <div className="packs-empty-title">No study packs yet</div>
              <p className="packs-empty-sub">Generate your first pack using the Generate tab above.</p>
              <button className="btn btn-brand" onClick={()=>setTab('generate')}>Generate my first pack ↗</button>
            </div>
          ) : myPacks.map(pack => (
            <div key={pack.id} className="packs-list-item">
              <div className="packs-list-icon">📦</div>
              <div className="packs-list-info">
                <div className="packs-list-title">{pack.title}</div>
                <div className="packs-list-meta">{pack.source_type} · {new Date(pack.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="packs-list-open"
                  onClick={() => { setActivePack(pack.content ? { ...pack.content, packId: pack.id } : pack); setTab('generate') }}>
                  Open →
                </button>
                <button
                  onClick={(e) => handleDelete(pack.id, e)}
                  disabled={deleting === pack.id}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)', padding: '4px 6px', borderRadius: 6, opacity: deleting === pack.id ? 0.4 : 1 }}
                  title="Delete pack"
                >
                  {deleting === pack.id ? '…' : '🗑'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
