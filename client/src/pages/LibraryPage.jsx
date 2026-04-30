import { useState, useEffect } from 'react'
import { getLibrary } from '../lib/aiApi.js'
import './LibraryPage.css'

const OFFLINE_KEY = 'padi_library_offline'

// Save item to localStorage for offline access
export function saveOffline(item) {
  try {
    const existing = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
    const updated  = [item, ...existing.filter(i => i.id !== item.id)]
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(updated.slice(0, 100))) // max 100 items
  } catch (err) {
    console.error('Offline save error:', err)
  }
}

// Load from localStorage
function loadOffline() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
  } catch (_e) {
    return []
  }
}

const TYPE_ICONS = {
  answer:      '💬',
  explanation: '💬',
  math:        '📐',
  study_pack:  '📦',
  summary:     '📄',
  exam:        '🎯',
  refinement:  '✏️',
}

const TYPE_LABELS = {
  answer:      'Answer',
  explanation: 'Explanation',
  math:        'Math solution',
  study_pack:  'Study pack',
  summary:     'Summary',
  exam:        'Exam result',
  refinement:  'Refined answer',
}

export default function LibraryPage() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline  = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [isOffline])

  const loadItems = async () => {
    setLoading(true)
    try {
      if (isOffline) {
        // Load from localStorage when offline
        setItems(loadOffline())
      } else {
        // Load from server, also merge with offline items
        const { items: serverItems } = await getLibrary()
        const offlineItems = loadOffline()
        // Merge — server items take precedence
        const serverIds = new Set(serverItems.map(i => i.id))
        const offlineOnly = offlineItems.filter(i => !serverIds.has(i.id))
        setItems([...serverItems, ...offlineOnly])
        // Update offline cache with server items
        localStorage.setItem(OFFLINE_KEY, JSON.stringify([...serverItems, ...offlineOnly].slice(0, 100)))
      }
    } catch (err) {
      // Fall back to offline
      setItems(loadOffline())
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(updated))
    if (selected?.id === id) setSelected(null)
  }

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === 'all' || item.item_type === filter
    const matchesSearch = !search || item.title?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const types = ['all', ...new Set(items.map(i => i.item_type))]

  return (
    <div className="library-page">
      <div className="library-header">
        <div>
          <h1 className="library-title">My Library</h1>
          <p className="library-sub">
            {isOffline
              ? '📴 You\'re offline — showing saved content'
              : `${items.length} saved item${items.length !== 1 ? 's' : ''} · available offline`}
          </p>
        </div>
        {isOffline && (
          <div className="library-offline-badge">📴 Offline mode</div>
        )}
      </div>

      {/* Search + filter */}
      <div className="library-controls">
        <input
          type="text"
          className="library-search"
          placeholder="Search your library..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="library-filters">
          {types.map(type => (
            <button
              key={type}
              className={`library-filter ${filter === type ? 'active' : ''}`}
              onClick={() => setFilter(type)}
            >
              {type === 'all' ? 'All' : TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      </div>

      <div className="library-layout">
        {/* Item list */}
        <div className="library-list">
          {loading ? (
            <div className="library-loading">
              <div className="library-spinner" />
              <span>Loading your library...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-icon">💾</div>
              <div className="library-empty-title">
                {search ? 'No results found' : 'Your library is empty'}
              </div>
              <p className="library-empty-sub">
                {search
                  ? 'Try a different search term.'
                  : 'Save answers, study packs, and summaries using the 💾 Save button on any AI response.'}
              </p>
            </div>
          ) : filteredItems.map(item => (
            <div
              key={item.id}
              className={`library-item ${selected?.id === item.id ? 'active' : ''}`}
              onClick={() => setSelected(selected?.id === item.id ? null : item)}
            >
              <div className="library-item-icon">
                {TYPE_ICONS[item.item_type] || '📄'}
              </div>
              <div className="library-item-info">
                <div className="library-item-title">{item.title}</div>
                <div className="library-item-meta">
                  <span className="library-item-type">
                    {TYPE_LABELS[item.item_type] || item.item_type}
                  </span>
                  <span>·</span>
                  <span>{new Date(item.saved_at || item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="library-item-actions">
                <span className="library-offline-dot" title="Available offline">●</span>
                <button
                  className="library-delete-btn"
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                  title="Remove from library"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Detail view */}
        {selected && (
          <div className="library-detail">
            <div className="library-detail-header">
              <div className="library-detail-type">
                {TYPE_ICONS[selected.item_type]} {TYPE_LABELS[selected.item_type] || selected.item_type}
              </div>
              <h2 className="library-detail-title">{selected.title}</h2>
              <div className="library-detail-date">
                Saved {new Date(selected.saved_at || selected.created_at).toLocaleDateString()}
              </div>
            </div>

            <div className="library-detail-content">
              {selected.item_type === 'study_pack' ? (
                <div>
                  {selected.content?.summary && (
                    <p className="library-detail-summary">{selected.content.summary}</p>
                  )}
                  {selected.content?.notes && (
                    <div
                      className="library-detail-text"
                      dangerouslySetInnerHTML={{
                        __html: selected.content.notes
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
                          .replace(/\n\n/g, '</p><p>')
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  className="library-detail-text"
                  dangerouslySetInnerHTML={{
                    __html: (selected.content?.answer || selected.content?.text || '')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
                      .replace(/\n\n/g, '</p><p>')
                  }}
                />
              )}
            </div>

            <div className="library-detail-actions">
              <button
                className="pack-action-btn pack-action-btn--whatsapp"
                onClick={() => {
                  const text = encodeURIComponent(
                    `📚 *${selected.title}*\n\n_Saved with Padi — yourpadi.com_`
                  )
                  window.open(`https://wa.me/?text=${text}`, '_blank')
                }}
              >
                📤 Share on WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
