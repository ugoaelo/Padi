import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteAccount, pauseSubscription, resumeSubscription, getSubscriptionStatus } from '../lib/api.js'
import './AccountPage.css'

export default function AccountPage() {
  const { profile, user, updateProfile, updateEmail, signOut } = useAuth()
  const navigate = useNavigate()

  // ── Preferred name ────────────────────────────────────────────────
  const [prefName,     setPrefName]     = useState(profile?.preferred_name || '')
  const [prefSaving,   setPrefSaving]   = useState(false)
  const [prefMsg,      setPrefMsg]      = useState('')

  // ── Email ─────────────────────────────────────────────────────────
  const [newEmail,     setNewEmail]     = useState('')
  const [emailSaving,  setEmailSaving]  = useState(false)
  const [emailMsg,     setEmailMsg]     = useState('')

  // ── WhatsApp ──────────────────────────────────────────────────────
  const [whatsapp,     setWhatsapp]     = useState(profile?.whatsapp || '')
  const [waSaving,     setWaSaving]     = useState(false)
  const [waMsg,        setWaMsg]        = useState('')

  // ── Subscription pause ────────────────────────────────────────────
  const [subStatus,    setSubStatus]    = useState(null)   // fetched on mount
  const [pauseMonths,  setPauseMonths]  = useState(1)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pausing,      setPausing]      = useState(false)
  const [resuming,     setResuming]     = useState(false)
  const [pauseMsg,     setPauseMsg]     = useState('')

  // ── Account deletion ──────────────────────────────────────────────
  const [deleteStep,   setDeleteStep]   = useState(0) // 0=hidden, 1=confirm, 2=final-confirm
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting,     setDeleting]     = useState(false)
  const [deleteMsg,    setDeleteMsg]    = useState('')

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  // ── Load subscription status on mount ────────────────────────────
  useEffect(() => {
    getSubscriptionStatus()
      .then(d => setSubStatus(d.subscription))
      .catch(() => {})
  }, [])

  // ── Pause subscription ────────────────────────────────────────────
  const handlePause = async () => {
    setPausing(true)
    setPauseMsg('')
    try {
      const result = await pauseSubscription(pauseMonths)
      setSubStatus(prev => ({ ...prev, paused_until: result.pausedUntil }))
      setPauseMsg('✓ ' + result.message)
      setShowPauseModal(false)
    } catch (err) {
      setPauseMsg(err.message || 'Failed to pause. Contact support@yourpadi.com')
    } finally {
      setPausing(false)
    }
  }

  // ── Resume subscription early ─────────────────────────────────────
  const handleResume = async () => {
    setResuming(true)
    setPauseMsg('')
    try {
      const result = await resumeSubscription()
      setSubStatus(prev => ({ ...prev, paused_until: null, current_period_end: result.newPeriodEnd }))
      setPauseMsg('✓ ' + result.message)
    } catch (err) {
      setPauseMsg(err.message || 'Failed to resume. Contact support@yourpadi.com')
    } finally {
      setResuming(false)
    }
  }

  // ── Save preferred name ───────────────────────────────────────────
  const savePrefName = async (e) => {
    e.preventDefault()
    setPrefSaving(true)
    setPrefMsg('')
    try {
      await updateProfile({ preferred_name: prefName.trim() || null })
      setPrefMsg('✓ Saved')
    } catch (err) {
      setPrefMsg(err.message || 'Failed to save.')
    } finally {
      setPrefSaving(false)
    }
  }

  // ── Request email change ──────────────────────────────────────────
  // Supabase sends a confirmation link to the NEW email address.
  // The change only takes effect once that link is clicked.
  const saveEmail = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    if (newEmail.trim() === user?.email) {
      setEmailMsg('That is already your current email.')
      return
    }
    setEmailSaving(true)
    setEmailMsg('')
    try {
      await updateEmail(newEmail.trim())
      setEmailMsg('✓ Confirmation sent to ' + newEmail.trim() + '. Click the link in that email to confirm the change.')
      setNewEmail('')
    } catch (err) {
      setEmailMsg(err.message || 'Failed to request email change.')
    } finally {
      setEmailSaving(false)
    }
  }

  // ── Save WhatsApp number ──────────────────────────────────────────
  const saveWhatsapp = async (e) => {
    e.preventDefault()
    setWaSaving(true)
    setWaMsg('')
    try {
      await updateProfile({ whatsapp: whatsapp.trim() || null })
      setWaMsg('✓ Saved')
    } catch (err) {
      setWaMsg(err.message || 'Failed to save.')
    } finally {
      setWaSaving(false)
    }
  }

  // ── Delete account ────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteMsg('')
    try {
      await deleteAccount()
      await signOut()
      navigate('/?account=deleted', { replace: true })
    } catch (err) {
      setDeleteMsg(err.message || 'Failed to delete account. Please try again or contact support.')
      setDeleteStep(0)
    } finally {
      setDeleting(false)
    }
  }

  const displayName = profile?.preferred_name || profile?.first_name || profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="account-page">
      <div className="account-header">
        <h1 className="account-title">Account settings</h1>
        <p className="account-sub">
          {profile?.first_name} {profile?.last_name} · {user?.email}
        </p>
      </div>

      {/* ── Preferred name ─────────────────────────────────────── */}
      <div className="account-card">
        <div className="account-card-label">What Padi calls you</div>
        <p className="account-card-hint">
          Padi greets you as <strong>{displayName}</strong>. Set a preferred name if you'd like something different — nickname, shortened version, anything.
        </p>
        <form className="account-form" onSubmit={savePrefName}>
          <input
            className="account-input"
            type="text"
            placeholder="e.g. Ugo, Mike, Dee"
            value={prefName}
            onChange={e => { setPrefName(e.target.value); setPrefMsg('') }}
          />
          <button className="btn btn-brand account-btn" type="submit" disabled={prefSaving}>
            {prefSaving ? 'Saving...' : 'Save'}
          </button>
          {prefMsg && <p className={`account-msg ${prefMsg.startsWith('✓') ? 'success' : 'error'}`}>{prefMsg}</p>}
        </form>
      </div>

      {/* ── Email change ───────────────────────────────────────── */}
      <div className="account-card">
        <div className="account-card-label">Email address</div>
        <p className="account-card-hint">
          Current: <strong>{user?.email}</strong><br />
          Enter a new email below. We'll send a confirmation link to that address — the change only takes effect once you click it.
        </p>
        <form className="account-form" onSubmit={saveEmail}>
          <input
            className="account-input"
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setEmailMsg('') }}
          />
          <button className="btn btn-brand account-btn" type="submit" disabled={emailSaving || !newEmail.trim()}>
            {emailSaving ? 'Sending...' : 'Request change'}
          </button>
          {emailMsg && <p className={`account-msg ${emailMsg.startsWith('✓') ? 'success' : 'error'}`}>{emailMsg}</p>}
        </form>
      </div>

      {/* ── WhatsApp number ────────────────────────────────────── */}
      <div className="account-card">
        <div className="account-card-label">WhatsApp number</div>
        <p className="account-card-hint">
          Used for support and important account updates only. Never shared.
        </p>
        <form className="account-form" onSubmit={saveWhatsapp}>
          <input
            className="account-input"
            type="tel"
            placeholder="+234 800 000 0000"
            value={whatsapp}
            onChange={e => { setWhatsapp(e.target.value); setWaMsg('') }}
          />
          <button className="btn btn-brand account-btn" type="submit" disabled={waSaving}>
            {waSaving ? 'Saving...' : 'Save'}
          </button>
          {waMsg && <p className={`account-msg ${waMsg.startsWith('✓') ? 'success' : 'error'}`}>{waMsg}</p>}
        </form>
      </div>

      {/* ── Subscription pause ─────────────────────────────────── */}
      {subStatus && subStatus.status === 'active' && (
        <div className="account-card">
          <div className="account-card-label">Pause subscription</div>
          {subStatus.paused_until && new Date(subStatus.paused_until) > new Date() ? (
            <>
              <p className="account-card-hint">
                Your subscription is <strong>paused</strong> until{' '}
                <strong>
                  {new Date(subStatus.paused_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </strong>.
                Access resumes automatically on that date — or resume early below.
              </p>
              <button
                className="btn btn-brand account-btn"
                onClick={handleResume}
                disabled={resuming}>
                {resuming ? 'Resuming...' : 'Resume now'}
              </button>
            </>
          ) : (
            <>
              <p className="account-card-hint">
                School not in session? Pause your subscription and we'll extend your access period by the same amount when you resume. Your data and study history are kept safely.
              </p>
              <button
                className="btn btn-brand account-btn"
                onClick={() => { setShowPauseModal(true); setPauseMsg('') }}>
                Pause subscription
              </button>
            </>
          )}
          {pauseMsg && (
            <p className={`account-msg ${pauseMsg.startsWith('✓') ? 'success' : 'error'}`}>
              {pauseMsg}
            </p>
          )}
        </div>
      )}

      {/* ── Pause modal ────────────────────────────────────────────── */}
      {showPauseModal && (
        <div className="account-modal-backdrop" onClick={() => setShowPauseModal(false)}>
          <div className="account-modal" onClick={e => e.stopPropagation()}>
            <div className="account-modal-title">Pause your subscription</div>
            <p className="account-modal-body">
              Choose how long to pause. Your access period will be extended by the same duration when you resume — so you never lose time you've paid for.
            </p>
            <div className="account-pause-options">
              {[1, 2, 3].map(m => (
                <button
                  key={m}
                  className={`account-pause-option ${pauseMonths === m ? 'selected' : ''}`}
                  onClick={() => setPauseMonths(m)}>
                  {m} month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>
            <p className="account-modal-note">
              ⚠️ For Paystack subscribers: billing is not paused at the payment provider. We will extend your Padi access period when you resume. Contact{' '}
              <a href="mailto:support@yourpadi.com">support@yourpadi.com</a>{' '}
              if you'd like to also cancel your Paystack plan during the break.
            </p>
            <div className="account-modal-actions">
              <button className="btn account-signout-btn" onClick={() => setShowPauseModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-brand account-btn"
                onClick={handlePause}
                disabled={pausing}>
                {pausing ? 'Pausing...' : `Pause for ${pauseMonths} month${pauseMonths > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign out ───────────────────────────────────────────── */}
      <div className="account-card account-card--danger">
        <div className="account-card-label">Sign out</div>
        <p className="account-card-hint">You'll be returned to the home page.</p>
        <button className="btn account-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {/* ── Delete account (NDPA right to erasure) ─────────────── */}
      <div className="account-card account-card--delete">
        <div className="account-card-label">Delete account</div>
        <p className="account-card-hint">
          Your account will be scheduled for deletion. You will receive an email with a link to reactivate within <strong>30 days</strong>. After that, all your personal data is permanently and irreversibly deleted in compliance with NDPA 2023.
        </p>

        {deleteStep === 0 && (
          <button className="btn account-delete-btn" onClick={() => setDeleteStep(1)}>
            Delete my account
          </button>
        )}

        {deleteStep === 1 && (
          <div className="account-delete-confirm">
            <p className="account-delete-warning">
              ⚠️ Are you sure? Type <strong>DELETE</strong> below to confirm.
            </p>
            <input
              className="account-input"
              type="text"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn account-signout-btn" onClick={() => { setDeleteStep(0); setDeleteConfirmText('') }}>
                Cancel
              </button>
              <button
                className="btn account-delete-btn"
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onClick={() => setDeleteStep(2)}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div className="account-delete-confirm">
            <p className="account-delete-warning">
              This is your last chance. Once confirmed, you will be signed out immediately. You have 30 days to reactivate via the link we will send to <strong>{user?.email}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn account-signout-btn" onClick={() => { setDeleteStep(0); setDeleteConfirmText('') }}>
                Cancel
              </button>
              <button
                className="btn account-delete-btn"
                disabled={deleting}
                onClick={handleDeleteAccount}>
                {deleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        )}

        {deleteMsg && <p className="account-msg error" style={{ marginTop: 10 }}>{deleteMsg}</p>}
      </div>
    </div>
  )
}
