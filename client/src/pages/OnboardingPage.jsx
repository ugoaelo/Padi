import { useEffect, useState } from 'react'
import { Link, useNavigate }  from 'react-router-dom'
import { useAuth }            from '../context/AuthContext'
import { getSchools }         from '../lib/contentApi.js'
import { addUserCourse }      from '../lib/contentApi.js'
import './AuthPages.css'
import './OnboardingPage.css'

const LEVELS = ['100', '200', '300', '400', '500', '600']

export default function OnboardingPage() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()

  const rawName = user?.user_metadata?.full_name || ''
  const parts   = rawName.split(' ')

  // ── Step 1 — personal details ──────────────────────────────────
  const [step, setStep] = useState(1)

  const [form, setForm] = useState({
    firstName:     parts[0] || '',
    lastName:      parts.slice(1).join(' ') || '',
    preferredName: '',
    dobDay:        '',
    dobMonth:      '',
    dobYear:       '',
    whatsapp:      '',
  })

  // ── Step 2 — school + dept + level ────────────────────────────
  const [schools,     setSchools]     = useState([])
  const [schoolQuery, setSchoolQuery] = useState('')
  const [selectedSchool,  setSelectedSchool]  = useState(null)
  const [selectedDept,    setSelectedDept]    = useState(null)
  const [selectedLevel,   setSelectedLevel]   = useState('')

  // ── Step 3 — course selection ─────────────────────────────────
  const [courses,         setCourses]         = useState([])
  const [selectedCourses, setSelectedCourses] = useState([])

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [agreed,  setAgreed]  = useState(false)

  // Fetch schools once
  useEffect(() => {
    getSchools()
      .then(d => setSchools(d.schools || []))
      .catch(() => {})
  }, [])

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setError('')
  }

  // ── Step 1 → 2 ────────────────────────────────────────────────
  const handleStep1 = (e) => {
    e.preventDefault()
    const { firstName, lastName, dobDay, dobMonth, dobYear } = form
    if (!firstName || !lastName || !dobDay || !dobMonth || !dobYear) {
      setError('Please fill in all required fields.')
      return
    }
    const day = parseInt(dobDay), month = parseInt(dobMonth), year = parseInt(dobYear)
    const maxYear = new Date().getFullYear() - 10
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1940 || year > maxYear) {
      setError('Please enter a valid date of birth.')
      return
    }
    setError('')
    setStep(2)
  }

  // ── Step 2 → 3: load courses for dept ─────────────────────────
  const handleStep2 = async (e) => {
    e.preventDefault()
    if (!selectedSchool) { setError('Please select your university.'); return }
    if (!selectedDept)   { setError('Please select your department.'); return }
    if (!selectedLevel)  { setError('Please select your level.'); return }
    setError('')

    setLoading(true)
    try {
      // Load courses for the selected dept from the server
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/content/schools/${selectedSchool.slug}/departments/${selectedDept.slug}/courses`
      )
      const data = await res.json()
      setCourses(data.courses || [])
      setStep(3)
    } catch {
      setError('Could not load courses. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Final submit ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agreed) {
      setError('Please agree to the Privacy Policy and Terms of Service to continue.')
      return
    }
    setLoading(true)
    try {
      const { firstName, lastName, preferredName, dobDay, dobMonth, dobYear, whatsapp } = form
      const dob      = `${dobYear}-${String(dobMonth).padStart(2,'0')}-${String(dobDay).padStart(2,'0')}`
      const fullName = `${firstName} ${lastName}`.trim()

      await updateProfile({
        full_name:      fullName,
        first_name:     firstName,
        last_name:      lastName,
        preferred_name: preferredName || null,
        dob,
        university:     selectedSchool.name,
        course:         selectedDept.name,
        whatsapp:       whatsapp || null,
        school_id:      selectedSchool.id,
        department_id:  selectedDept.id,
        level:          selectedLevel,
        plan_tier:      'base',
      })

      // Enrol user in selected courses
      await Promise.allSettled(
        selectedCourses.map(courseId => addUserCourse(courseId))
      )

      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Profile update error:', err)
      setError(err.message || 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── School search filter ──────────────────────────────────────
  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolQuery.toLowerCase())
  )

  const toggleCourse = (id) => {
    setSelectedCourses(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
    setError('')
  }

  return (
    <div className="auth-bg">
      <div className="auth-card onboard-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="auth-logo-text">PADI</span>
        </div>

        {/* Step indicator */}
        <div className="onboard-steps">
          {[1,2,3].map(n => (
            <div key={n} className={`onboard-step-dot ${step >= n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
              {step > n ? '✓' : n}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Profile ─────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="auth-onboard-badge">Almost there 🎉</div>
            <h1 className="auth-title">Set up your profile</h1>
            <p className="auth-sub">Help Padi personalise your study experience</p>

            <form className="auth-form" onSubmit={handleStep1} noValidate>
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
                <label className="auth-label">WhatsApp number <span className="auth-optional">(optional)</span></label>
                <input type="tel" name="whatsapp" className="auth-input"
                  placeholder="+234 800 000 0000" value={form.whatsapp} onChange={handleChange} />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="btn btn-brand auth-submit">
                Continue →
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2: School + Dept + Level ──────────────────── */}
        {step === 2 && (
          <>
            <h1 className="auth-title">Your university</h1>
            <p className="auth-sub">We'll show you the right course content</p>

            <form className="auth-form" onSubmit={handleStep2} noValidate>

              {/* School search */}
              <div className="auth-field">
                <label className="auth-label">University / School</label>
                {selectedSchool ? (
                  <div className="onboard-selected-chip">
                    <span>🏫 {selectedSchool.name}</span>
                    <button type="button" className="onboard-chip-clear"
                      onClick={() => { setSelectedSchool(null); setSelectedDept(null); setSchoolQuery('') }}>✕</button>
                  </div>
                ) : (
                  <>
                    <input type="text" className="auth-input"
                      placeholder="Search for your university..."
                      value={schoolQuery}
                      onChange={e => { setSchoolQuery(e.target.value); setError('') }} />
                    {schoolQuery.length >= 2 && (
                      <div className="onboard-dropdown">
                        {filteredSchools.length === 0
                          ? <div className="onboard-dropdown-empty">No schools found yet — more coming soon</div>
                          : filteredSchools.map(s => (
                            <button type="button" key={s.id} className="onboard-dropdown-item"
                              onClick={() => { setSelectedSchool(s); setSelectedDept(null); setSchoolQuery('') }}>
                              {s.name}
                              {s.short_name && <span className="onboard-school-short"> ({s.short_name})</span>}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Department */}
              {selectedSchool && (
                <div className="auth-field">
                  <label className="auth-label">Department</label>
                  {selectedDept ? (
                    <div className="onboard-selected-chip">
                      <span>📚 {selectedDept.name}</span>
                      <button type="button" className="onboard-chip-clear"
                        onClick={() => setSelectedDept(null)}>✕</button>
                    </div>
                  ) : (
                    <div className="onboard-dept-grid">
                      {(selectedSchool.departments || []).map(d => (
                        <button type="button" key={d.id} className="onboard-dept-btn"
                          onClick={() => setSelectedDept(d)}>
                          {d.name}
                        </button>
                      ))}
                      {(selectedSchool.departments || []).length === 0 && (
                        <p className="onboard-dept-empty">No departments loaded yet for this school</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Level */}
              {selectedDept && (
                <div className="auth-field">
                  <label className="auth-label">Level</label>
                  <div className="onboard-level-grid">
                    {LEVELS.map(l => (
                      <button type="button" key={l}
                        className={`onboard-level-btn ${selectedLevel === l ? 'active' : ''}`}
                        onClick={() => { setSelectedLevel(l); setError('') }}>
                        {l}L
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <div className="auth-error">{error}</div>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn auth-submit"
                  style={{ background: '#1E1E2E', color: '#A1A1AA', flex: '0 0 auto' }}
                  onClick={() => { setStep(1); setError('') }}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-brand auth-submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Loading courses...' : 'Next →'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── STEP 3: Course selection ────────────────────────── */}
        {step === 3 && (
          <>
            <h1 className="auth-title">Your courses</h1>
            <p className="auth-sub">
              Select the courses you're doing this semester.<br />
              You can add more later from the dashboard.
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {courses.length === 0 ? (
                <div className="onboard-no-courses">
                  <p>No courses are loaded for this department yet.</p>
                  <p style={{ fontSize: 13, color: '#71717A' }}>
                    You can still continue — you'll be able to browse and add courses once content is added.
                  </p>
                </div>
              ) : (
                <div className="onboard-course-list">
                  {courses.map(c => (
                    <label key={c.id} className={`onboard-course-item ${selectedCourses.includes(c.id) ? 'selected' : ''}`}>
                      <input type="checkbox" className="onboard-course-check"
                        checked={selectedCourses.includes(c.id)}
                        onChange={() => toggleCourse(c.id)} />
                      <div className="onboard-course-info">
                        <div className="onboard-course-code">{c.course_code}</div>
                        <div className="onboard-course-title">{c.course_title}</div>
                      </div>
                      <div className={`onboard-course-tick ${selectedCourses.includes(c.id) ? 'visible' : ''}`}>✓</div>
                    </label>
                  ))}
                </div>
              )}

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
                <button type="button" className="btn auth-submit"
                  style={{ background: '#1E1E2E', color: '#A1A1AA', flex: '0 0 auto' }}
                  onClick={() => { setStep(2); setError('') }}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-brand auth-submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Setting up...' : 'Start studying with Padi ↗'}
                </button>
              </div>

              {courses.length > 0 && (
                <button type="button" className="onboard-skip-courses"
                  onClick={() => {
                    if (!agreed) { setError('Please agree to the Privacy Policy and Terms of Service to continue.'); return }
                    setSelectedCourses([])
                    handleSubmit({ preventDefault: () => {} })
                  }}>
                  Skip for now — I'll add courses later
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
