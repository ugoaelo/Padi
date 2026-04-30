import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyPaystackPayment } from '../lib/api.js'
import { useAuth } from '../context/AuthContext'
import './PaymentPages.css'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const { fetchProfile, user } = useAuth()
  const navigate = useNavigate()
  const [status,  setStatus]  = useState('verifying') // verifying | success | error
  const [isFoundingMember, setIsFoundingMember] = useState(false)

  useEffect(() => {
    const verify = async () => {
      // Paystack redirects with ?reference=xxx
      const reference = searchParams.get('reference')
      // Stripe redirects with ?session_id=xxx (handled by webhook — just show success)
      const sessionId = searchParams.get('session_id')

      try {
        if (reference) {
          const result = await verifyPaystackPayment(reference)
          setIsFoundingMember(result.isFoundingMember)
        }
        // Stripe subscription activated via webhook — no extra verification needed here
        // Refresh user profile to get updated founding member status
        if (user) await fetchProfile(user.id)
        setStatus('success')
      } catch (err) {
        console.error('Payment verification error:', err)
        setStatus('error')
      }
    }

    verify()
  }, [user, fetchProfile, searchParams])

  if (status === 'verifying') {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <div className="payment-spinner" />
          <p className="payment-verifying-text">Confirming your payment...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="payment-page">
        <div className="payment-card">
          <div className="payment-icon">⚠️</div>
          <h1 className="payment-title">Something went wrong</h1>
          <p className="payment-sub">
            Your payment may have gone through. Please check your email for a receipt,
            or contact <a href="mailto:support@yourpadi.com">support@yourpadi.com</a>.
          </p>
          <button className="btn btn-brand payment-cta" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-page">
      <div className="payment-card">
        <div className="payment-icon">🎉</div>
        <h1 className="payment-title">You're in!</h1>

        {isFoundingMember && (
          <div className="payment-founding-badge">
            ⭐ Founding Member — ₦3,000/month locked forever
          </div>
        )}

        <p className="payment-sub">
          Welcome to Padi. Your subscription is active and you have full access to everything.
          Time to start studying smarter.
        </p>

        <button className="btn btn-brand payment-cta" onClick={() => navigate('/dashboard')}>
          Start studying with Padi ↗
        </button>

        <p className="payment-refund-note">
          🛡️ Remember — if Padi isn't for you, you have 48 hours to request a full refund.
          No questions asked.
        </p>
      </div>
    </div>
  )
}
