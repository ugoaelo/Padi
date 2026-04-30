import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPages.css'

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const fromWaitlist = location.state?.fromWaitlist || false
  const prefilled    = location.state || {}

  const [step, setStep] = useState(fromWaitlist ? 2 : 1)
  const [form, setForm] = useState({
    email:           prefilled.email      || '',
    password:        '',
    confirmPassword: '',
    firstName:       prefilled.firstName  || '',
    lastName:        prefilled.lastName   || '',
    preferredName:   '',
    dobDay:          '',
    dobMonth:        '',
    dobYear:         '',
    university:      prefilled.university || '',
    course:          prefilled.course     || '',
    whatsapp:        '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [agreed,  setAgreed]  = useState(false)

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleStep1 = (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.confirmPassword) { setError('Please fill in all fields.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.dobDay || !form.dobMonth || !form.dobYear || !form.university || !form.course) {
      setError('Please fill in all required fields.')
      return
    }
    if (!agreed) {
      setError('Please agree to the Privacy Policy and Terms of Service to continue.')
      return
    }
    const day = parseInt(form.dobDay), month = parseInt(form.dobMonth), year = parseInt(form.dobYear)
    const maxDobYear = new Date().getFullYear() - 10
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1940 || year > maxDobYear) {
      setError('Please enter a valid date of birth.')
      return
    }
    const dob = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    setLoading(true)
    try {
      await signUpWithEmail({ ...form, dob })
      navigate('/check-email', { replace: true })
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try { await signInWithGoogle() }
    catch (err) { setError('Google sign-in failed. Please try again.'); setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <div className="auth-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="auth-logo-text">PADI</span>
        </Link>

        {fromWaitlist && (
          <div className="auth-founding-banner">
            🌟 First cohort member — ₦1,500 first month, then ₦3,000 locked forever
          </div>
        )}

        <div className="auth-steps">
          <div className={`auth-step ${step >= 1 ? 'active' : ''}`}>
            <div className="auth-step-dot">{step > 1 ? '✓' : '1'}</div>
            <span>Account</span>
          </div>
          <div className="auth-step-line" />
          <div className={`auth-step ${step >= 2 ? 'active' : ''}`}>
            <div className="auth-step-dot">2</div>
            <span>Profile</span>
          </div>
        </div>

        {step === 1 && (
          <>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-sub">One step away from studying smarter</p>
            <div className="auth-oauth">
              <button className="oauth-btn" onClick={handleGoogle} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
            <div className="auth-divider"><span>or sign up with email</span></div>
            <form className="auth-form" onSubmit={handleStep1} noValidate>
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <input type="email" name="email" className="auth-input"
                  placeholder="you@example.com" value={form.email}
                  onChange={handleChange} autoComplete="email" required />
              </div>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input type="password" name="password" className="auth-input"
                  placeholder="At least 8 characters" value={form.password}
                  onChange={handleChange} autoComplete="new-password" required />
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm password</label>
                <input type="password" name="confirmPassword" className="auth-input"
                  placeholder="Same password again" value={form.confirmPassword}
                  onChange={handleChange} autoComplete="new-password" required />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-brand auth-submit">Continue →</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title">{fromWaitlist ? 'Almost there' : 'Tell us about yourself'}</h1>
            <p className="auth-sub">So Padi can personalise your study experience</p>
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-row">
                <div className="auth-field">
                  <label className="auth-label">First name</label>
                  <input type="text" name="firstName" className="auth-input"
                    placeholder="First name" value={form.firstName} onChange={handleChange} required />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Last name</label>
                  <input type="text" name="lastName" className="auth-input"
                    placeholder="Last name" value={form.lastName} onChange={handleChange} required />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  Preferred name <span className="auth-optional">(optional — what should Padi call you?)</span>
                </label>
                <input type="text" name="preferredName" className="auth-input"
                  placeholder="e.g. Ugo, Mike, Dee" value={form.preferredName} onChange={handleChange} />
              </div>
              <div className="auth-field">
                <label className="auth-label">Date of birth</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" name="dobDay" className="auth-input"
                    placeholder="DD" min="1" max="31" style={{ width: 70 }}
                    value={form.dobDay} onChange={handleChange} required />
                  <input type="number" name="dobMonth" className="auth-input"
                    placeholder="MM" min="1" max="12" style={{ width: 80 }}
                    value={form.dobMonth} onChange={handleChange} required />
                  <input type="number" name="dobYear" className="auth-input"
                    placeholder="YYYY" min="1940" max={new Date().getFullYear() - 10} style={{ flex: 1 }}
                    value={form.dobYear} onChange={handleChange} required />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">University / School</label>
                <input type="text" name="university" className="auth-input"
                  placeholder="e.g. University of Lagos" value={form.university} onChange={handleChange} required />
              </div>
              <div className="auth-field">
                <label className="auth-label">Course of study</label>
                <input type="text" name="course" className="auth-input"
                  placeholder="e.g. Economics" value={form.course} onChange={handleChange} required />
              </div>
              <div className="auth-field">
                <label className="auth-label">WhatsApp number <span className="auth-optional">(optional)</span></label>
                <input type="tel" name="whatsapp" className="auth-input"
                  placeholder="+234 800 000 0000" value={form.whatsapp} onChange={handleChange} />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <label className="auth-consent-row">
                <input
                  type="checkbox"
                  className="auth-consent-check"
                  checked={agreed}
                  onChange={e => { setAgreed(e.target.checked); setError('') }}
                />
                <span className="auth-consent-text">
                  I have read and agree to Padi's{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>
                  {' '}and{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer">Terms of Service</Link>.
                </span>
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {!fromWaitlist && (
                  <button type="button" className="btn btn-ghost auth-submit" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
                )}
                <button type="submit" className="btn btn-brand auth-submit" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create account ↗'}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  )
}