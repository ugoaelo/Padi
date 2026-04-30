import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './WaitlistForm.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function WaitlistForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '', dobDay: '', dobMonth: '', dobYear: '',
    email: '', university: '', course: '', whatsapp: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.fullName || !form.dobDay || !form.dobMonth || !form.dobYear || !form.email || !form.university || !form.course) {
      setError('Please fill in all required fields.')
      return
    }

    const day   = parseInt(form.dobDay)
    const month = parseInt(form.dobMonth)
    const year  = parseInt(form.dobYear)

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1990 || year > 2010) {
      setError('Please enter a valid date of birth.')
      return
    }

    const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fullName: form.fullName, dob,
          email: form.email, university: form.university,
          course: form.course, whatsapp: form.whatsapp,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')

      // Redirect to signup — pass their email so we can pre-fill it
      navigate('/signup', {
        state: {
          fromWaitlist: true,
          email:        form.email,
          fullName:     form.fullName,
          university:   form.university,
          course:       form.course,
          dob,
        }
      })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again or email support@yourpadi.com')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <div className="form-founding-note">
        🌟 <strong>Founding member offer:</strong> Base ₦1,500 · Premium ₦2,500 for your first month.
        Base locks at ₦3,000/month · Premium locks at ₦4,500/month — forever, even as prices rise.
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Full name</label>
          <input type="text" name="fullName" className="form-input"
            placeholder="Your full name" value={form.fullName}
            onChange={handleChange} required />
        </div>
        <div className="form-field">
          <label className="form-label">Date of birth</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" name="dobDay" className="form-input"
              placeholder="DD" min="1" max="31" style={{ width: 70 }}
              value={form.dobDay} onChange={handleChange} required />
            <input type="number" name="dobMonth" className="form-input"
              placeholder="MM" min="1" max="12" style={{ width: 80 }}
              value={form.dobMonth} onChange={handleChange} required />
            <input type="number" name="dobYear" className="form-input"
              placeholder="YYYY" min="1990" max="2010" style={{ flex: 1 }}
              value={form.dobYear} onChange={handleChange} required />
          </div>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Email address</label>
        <input type="email" name="email" className="form-input"
          placeholder="you@example.com" value={form.email}
          onChange={handleChange} required />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">University / School</label>
          <input type="text" name="university" className="form-input"
            placeholder="e.g. University of Lagos" value={form.university}
            onChange={handleChange} required />
        </div>
        <div className="form-field">
          <label className="form-label">Course of study</label>
          <input type="text" name="course" className="form-input"
            placeholder="e.g. Economics" value={form.course}
            onChange={handleChange} required />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">
          WhatsApp number <span className="form-label-optional">(recommended — we'll send your access link here)</span>
        </label>
        <input type="tel" name="whatsapp" className="form-input"
          placeholder="+234 800 000 0000" value={form.whatsapp}
          onChange={handleChange} />
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" className="btn btn-brand btn-lg form-submit" disabled={loading}>
        {loading ? 'Securing your spot...' : 'Secure my founding spot ↗'}
      </button>

      <p className="form-privacy">
        🔒 Your information is private. You'll set a password on the next step.
      </p>
    </form>
  )
}