import { useState } from 'react'
import { cancelSubscription } from '../lib/api.js'

const REASONS = [
  { id: 'too_expensive',    label: 'Too expensive' },
  { id: 'not_using',        label: "Not using it enough" },
  { id: 'exams_over',       label: 'My exams are over / semester ended' },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'better_option',    label: 'Found a better alternative' },
  { id: 'other',            label: 'Other' },
]

/**
 * CancellationModal
 *
 * Shows a retention-focused cancellation flow with churn reason collection.
 * Props:
 *   onConfirmed — called after successful cancellation
 *   onDismissed — called when user changes their mind
 */
export default function CancellationModal({ onConfirmed, onDismissed }) {
  const [step,         setStep]         = useState('reason')  // 'reason' | 'confirm' | 'done'
  const [reason,       setReason]       = useState('')
  const [reasonDetail, setReasonDetail] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function handleCancel() {
    if (!reason) { setError('Please select a reason so we can improve.'); return }
    setLoading(true)
    setError('')
    try {
      await cancelSubscription({ reason, reasonDetail: reasonDetail.trim() || undefined })
      setStep('done')
    } catch (err) {
      setError(err.message || 'Cancellation failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const overlay = {
    position:       'fixed',
    inset:          0,
    background:     'rgba(0,0,0,0.6)',
    zIndex:         1000,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        16,
  }

  const card = {
    background:   'white',
    borderRadius: 16,
    padding:      '32px 28px',
    maxWidth:     460,
    width:        '100%',
    boxShadow:    '0 20px 60px rgba(0,0,0,0.25)',
  }

  if (step === 'done') {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0C0C14', marginBottom: 8 }}>
              Subscription cancelled
            </h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 24 }}>
              Sorry to see you go. Your access continues until the end of your current billing period.
              You're always welcome back.
            </p>
            <button
              onClick={onConfirmed}
              style={{ background: '#4F46E5', color: 'white', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div style={overlay}>
        <div style={card}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0C0C14', marginBottom: 8 }}>
            Are you sure?
          </h2>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 20 }}>
            You'll lose access to all study packs, exam simulations, and AI answers at the end of your
            current billing period. Your saved library won't be deleted.
          </p>
          {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <button
              onClick={onDismissed}
              style={{ background: '#4F46E5', color: 'white', border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              Keep my subscription
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              style={{ background: 'transparent', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 20px', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Cancelling...' : 'Yes, cancel my subscription'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // step === 'reason'
  return (
    <div style={overlay}>
      <div style={card}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0C0C14', marginBottom: 6 }}>
          Before you go...
        </h2>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
          Why are you cancelling? This helps us make Padi better.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {REASONS.map(r => (
            <label key={r.id} style={{
              display:       'flex',
              alignItems:    'center',
              gap:           10,
              padding:       '10px 14px',
              borderRadius:  8,
              border:        `2px solid ${reason === r.id ? '#4F46E5' : '#E5E5E5'}`,
              background:    reason === r.id ? '#EEF2FF' : 'white',
              cursor:        'pointer',
              fontSize:      14,
              color:         '#333',
              transition:    'all 0.15s',
            }}>
              <input
                type="radio"
                name="reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                style={{ accentColor: '#4F46E5' }}
              />
              {r.label}
            </label>
          ))}
        </div>

        {reason && (
          <textarea
            placeholder="Any extra details? (optional)"
            value={reasonDetail}
            onChange={e => setReasonDetail(e.target.value)}
            rows={2}
            style={{
              width:        '100%',
              border:       '1px solid #E5E5E5',
              borderRadius: 8,
              padding:      '10px 12px',
              fontSize:     14,
              color:        '#333',
              resize:       'none',
              marginBottom: 16,
              boxSizing:    'border-box',
              outline:      'none',
              fontFamily:   'inherit',
            }}
          />
        )}

        {error && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onDismissed}
            style={{ flex: 1, background: '#F3F4F6', color: '#333', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Never mind
          </button>
          <button
            onClick={() => { if (!reason) { setError('Please select a reason.'); return }; setError(''); setStep('confirm') }}
            style={{ flex: 1, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
