import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initializePaystackPayment } from '../lib/api.js'
import './PricingPage.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const BASE_FEATURES = [
  'Tutorial question bank — all your courses',
  '3 AI solutions per course per semester',
  'Unlimited AI answers and explanations',
  'Unlimited study pack generation',
  'Exam simulations — timed & scored',
  'Spaced repetition scheduling',
  'Offline library — save anything',
  'Step-by-step maths solutions',
]

const PREMIUM_FEATURES = [
  'Everything in Base',
  '5 AI solutions per course per semester',
  'Unlimited practice question generation',
  'Past paper pattern analysis',
  'Citations on every text answer',
  'Priority AI (faster responses)',
  'WhatsApp share on every output',
]

export default function PricingPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [selectedTier, setSelectedTier] = useState('base') // 'base' | 'premium'
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [foundingOpen, setFoundingOpen] = useState(false)
  const [spotsLeft,    setSpotsLeft]    = useState(100)

  useEffect(() => {
    fetch(`${API_URL}/api/payments/founding-count`)
      .then(r => r.json())
      .then(d => {
        const remaining = Math.max(0, 100 - (d.count || 0))
        setSpotsLeft(remaining)
        setFoundingOpen(remaining > 0)
      })
      .catch(() => {})
  }, [])

  const handlePaystack = async () => {
    if (!user) { navigate('/signup'); return }
    setLoading(true)
    setError('')
    try {
      const { authorizationUrl } = await initializePaystackPayment({ tier: selectedTier })
      window.location.href = authorizationUrl
    } catch (err) {
      setError(err.message || 'Payment initialization failed. Please try again.')
      setLoading(false)
    }
  }

  const basePrice    = foundingOpen ? { normal: 3000, first: 1500, locked: 3000 } : { normal: 3000, first: null, locked: null }
  const premiumPrice = foundingOpen ? { normal: 7000, first: 2500, locked: 4500 } : { normal: 7000, first: null, locked: null }
  const currentPrice = selectedTier === 'base' ? basePrice : premiumPrice

  return (
    <div className="pricing-page">
      <div className="pricing-page-inner">

        {/* Header */}
        <div className="pricing-page-header">
          <a href="/" className="pricing-back">← Back to home</a>
          <div className="pricing-page-badge">Simple pricing</div>
          <h1 className="pricing-page-title">
            Two plans.<br />Everything included.
          </h1>
          <p className="pricing-page-sub">
            Both plans include full TQ access. Upgrade to Premium for more solves.
          </p>
        </div>

        {/* Founding banner */}
        {foundingOpen && (
          <div className="pricing-founding-alert">
            🌟 <strong>First cohort:</strong> {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining.
            Get your price locked forever — Base ₦1,500 first month (then ₦3,000/month), Premium ₦2,500 first month (then ₦4,500/month).
          </div>
        )}

        {/* Tier toggle */}
        <div className="pricing-tier-toggle">
          <button
            className={`pricing-tier-btn ${selectedTier === 'base' ? 'active' : ''}`}
            onClick={() => setSelectedTier('base')}>
            Base · ₦3,000/mo
          </button>
          <button
            className={`pricing-tier-btn ${selectedTier === 'premium' ? 'active' : ''}`}
            onClick={() => setSelectedTier('premium')}>
            Premium · ₦7,000/mo
          </button>
        </div>

        {/* Card */}
        <div className={`pricing-main-card ${selectedTier === 'premium' ? 'pricing-main-card--premium' : ''}`}>
          <div className="pricing-main-header">
            {profile?.founding_member && (
              <div className="pricing-founding-badge">⭐ Founding Member — Price locked forever</div>
            )}
            {selectedTier === 'premium' && (
              <div className="pricing-tier-label">Premium</div>
            )}
            <div className="pricing-main-amount">
              {currentPrice.first ? (
                <>
                  <span className="pricing-naira">₦</span>{currentPrice.first.toLocaleString()}
                  <span className="pricing-first-month-tag">first month</span>
                </>
              ) : (
                <>
                  <span className="pricing-naira">₦</span>{currentPrice.normal.toLocaleString()}
                </>
              )}
            </div>
            {currentPrice.first && (
              <div className="pricing-then-note">then ₦{currentPrice.locked.toLocaleString()}/month, locked forever</div>
            )}
            {!currentPrice.first && (
              <div className="pricing-main-period">per month · cancel any time</div>
            )}
            <div className="pricing-usd-note">
              International cards accepted via Paystack
            </div>
          </div>

          <div className="pricing-main-body">
            <div className="pricing-features-heading">
              {selectedTier === 'base' ? 'Base plan includes' : 'Premium plan includes'}
            </div>
            <ul className="pricing-features">
              {(selectedTier === 'base' ? BASE_FEATURES : PREMIUM_FEATURES).map(f => (
                <li key={f}>
                  <span className="pricing-check">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {error && <div className="pricing-error">{error}</div>}

            {/* Payment button */}
            <div className="pricing-pay-section">
              <button
                className="pricing-pay-btn pricing-pay-btn--paystack"
                onClick={handlePaystack}
                disabled={loading}>
                {loading ? (
                  <span className="pricing-btn-loading">Processing...</span>
                ) : (
                  <>
                    <span className="pricing-pay-btn-main">Subscribe with Paystack</span>
                    <span className="pricing-pay-btn-sub">Card · Bank transfer · USSD · International cards</span>
                  </>
                )}
              </button>
            </div>

            <div className="pricing-guarantees">
              <div className="pricing-guarantee-item">
                🛡️ <strong>48-hour full refund</strong> — not happy? Get every naira back, no questions.
              </div>
              <div className="pricing-guarantee-item">
                🔒 <strong>Secure payments</strong> — your card details never touch our servers.
              </div>
              <div className="pricing-guarantee-item">
                ❌ <strong>Cancel any time</strong> — no contracts, no lock-in.
              </div>
            </div>
          </div>
        </div>

        {/* Tier comparison */}
        <div className="pricing-compare-section">
          <div className="pricing-compare-title">Base vs Premium — what's the difference?</div>
          <div className="pricing-compare-grid">
            <div className="pricing-compare-col">
              <div className="pricing-compare-col-header">Base · ₦3,000/mo</div>
              {BASE_FEATURES.map(f => (
                <div key={f} className="pricing-compare-row"><span className="pricing-check-sm">✓</span> {f}</div>
              ))}
            </div>
            <div className="pricing-compare-col pricing-compare-col--premium">
              <div className="pricing-compare-col-header">Premium · ₦7,000/mo</div>
              {PREMIUM_FEATURES.map(f => (
                <div key={f} className="pricing-compare-row"><span className="pricing-check-sm">✓</span> {f}</div>
              ))}
            </div>
          </div>
          <p style={{textAlign:'center', fontSize:13, color:'#666', marginTop:16}}>
            Not sure? Start on Base — you can upgrade any time.
          </p>
        </div>

      </div>
    </div>
  )
}
