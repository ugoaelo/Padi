import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/dashboard',           icon: '⊞', label: 'Dashboard' },
  { to: '/tutorial-questions',  icon: '📖', label: 'Tutorial Questions' },
  { to: '/ask',                 icon: '💬', label: 'Ask Padi' },
  { to: '/study-packs',         icon: '📦', label: 'Study Packs' },
  { to: '/exam',                icon: '🎯', label: 'Exam Sim' },
  { to: '/past-questions',      icon: '🔮', label: 'Past Papers' },
  { to: '/review',              icon: '🧠', label: 'Review' },
  { to: '/library',             icon: '💾', label: 'My Library' },
]

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [pausedUntil, setPausedUntil] = useState(null) // set when SUBSCRIPTION_PAUSED fires

  // ── Listen for paused-subscription events from any API call ──────
  useEffect(() => {
    function onPaused(e) { setPausedUntil(e.detail?.pausedUntil || true) }
    function onDeleted() { signOut().then(() => navigate('/', { replace: true })) }
    window.addEventListener('padi:subscription-paused', onPaused)
    window.addEventListener('padi:account-deleted',     onDeleted)
    return () => {
      window.removeEventListener('padi:subscription-paused', onPaused)
      window.removeEventListener('padi:account-deleted',     onDeleted)
    }
  }, [signOut, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  const displayName = profile?.preferred_name || profile?.first_name || profile?.full_name?.split(' ')[0] || 'Student'
  const pauseDate   = pausedUntil && pausedUntil !== true
    ? new Date(pausedUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-top">
          <a href="/" className="sidebar-logo">
            <div className="sidebar-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="sidebar-logo-text">PADI</span>
          </a>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}>
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-label">{item.label}</span>
              </NavLink>
            ))}
            {profile?.is_admin && (
              <NavLink to="/admin" className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}>
                <span className="sidebar-nav-icon">⚙️</span>
                <span className="sidebar-nav-label">Admin</span>
              </NavLink>
            )}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/account" className={({ isActive }) => `sidebar-support ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}>
            <span>⚙️</span><span>Account</span>
          </NavLink>
          <a href="mailto:support@yourpadi.com" className="sidebar-support">
            <span>💬</span><span>Support</span>
          </a>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {(profile?.first_name?.[0] || profile?.full_name?.[0] || '?').toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {displayName}
                {profile?.founding_member && <span className="sidebar-founding-badge">⭐</span>}
              </div>
              <div className="sidebar-user-course">{profile?.course || 'Padi Student'}</div>
            </div>
            <button className="sidebar-signout" onClick={handleSignOut} title="Sign out">↪</button>
          </div>
        </div>
      </aside>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <main className="app-main">
        <div className="app-topbar">
          <button className="app-topbar-menu" onClick={() => setMobileOpen(true)}>☰</button>
          <div className="app-topbar-logo">
            <div className="sidebar-logo-mark" style={{width:28,height:28,borderRadius:8}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>
              </svg>
            </div>
            <span className="sidebar-logo-text" style={{fontSize:17}}>PADI</span>
          </div>
          <div style={{width:40}} />
        </div>
        {/* ── Subscription paused banner ─────────────────────── */}
        {pausedUntil && (
          <div className="app-paused-banner">
            <span>⏸ Your subscription is paused{pauseDate ? ` until ${pauseDate}` : ''}.</span>
            <button className="app-paused-banner-btn" onClick={() => { setPausedUntil(null); navigate('/account') }}>
              Resume access →
            </button>
            <button className="app-paused-banner-dismiss" onClick={() => setPausedUntil(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        <div className="app-content"><Outlet /></div>
      </main>
    </div>
  )
}