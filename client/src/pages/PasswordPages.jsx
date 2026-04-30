import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPages.css'

// ── Forgot Password ───────────────────────────────────────────────
export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
            </svg>
          </div>
          <span className="auth-logo-text">PADI</span>
        </Link>

        {sent ? (
          <div className="auth-success">
            <div className="auth-success-icon">📬</div>
            <h2 className="auth-title">Check your inbox</h2>
            <p className="auth-sub">
              We sent a password reset link to <strong>{email}</strong>.
              Check your spam folder if you don't see it.
            </p>
            <Link to="/login" className="btn btn-brand auth-submit" style={{display:'block', textAlign:'center', marginTop:24}}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Reset your password</h1>
            <p className="auth-sub">Enter your email and we'll send you a reset link</p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <input type="email" className="auth-input"
                  placeholder="you@example.com" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  autoComplete="email" required />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-brand auth-submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link →'}
              </button>
            </form>

            <p className="auth-switch">
              Remember it? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Reset Password ────────────────────────────────────────────────
export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [form,    setForm]    = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.password || !form.confirm) { setError('Please fill in both fields.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await updatePassword(form.password)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
            </svg>
          </div>
          <span className="auth-logo-text">PADI</span>
        </Link>

        {done ? (
          <div className="auth-success">
            <div className="auth-success-icon">✅</div>
            <h2 className="auth-title">Password updated</h2>
            <p className="auth-sub">Your password has been changed successfully.</p>
            <Link to="/login" className="btn btn-brand auth-submit"
              style={{display:'block', textAlign:'center', marginTop:24}}>
              Sign in with new password
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-sub">Choose a strong password for your account</p>
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label">New password</label>
                <input type="password" className="auth-input"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={e => { setForm(p => ({...p, password: e.target.value})); setError('') }}
                  required />
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm new password</label>
                <input type="password" className="auth-input"
                  placeholder="Same password again"
                  value={form.confirm}
                  onChange={e => { setForm(p => ({...p, confirm: e.target.value})); setError('') }}
                  required />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-brand auth-submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update password →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
