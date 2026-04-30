import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Blocks unauthenticated users ──────────────────────────────────
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If user signed up via OAuth and hasn't completed onboarding yet
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

// ── Blocks authenticated users (e.g. login page) ─────────────────
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return children
}

// ── Full page loader ──────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0C0C14',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '3px solid rgba(79,70,229,0.2)',
        borderTopColor: '#4F46E5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
