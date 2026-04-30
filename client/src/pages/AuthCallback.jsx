import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// This page handles the redirect back from Google/Apple OAuth
// Supabase exchanges the code for a session automatically
export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        navigate('/login?error=oauth_failed', { replace: true })
        return
      }

      // Check if user has a profile (existing user vs new signup)
      const { data: profile } = await supabase
        .from('profiles')
        .select('university')
        .eq('id', session.user.id)
        .single()

      if (!profile || !profile.university) {
        // New OAuth user — needs to complete profile
        navigate('/onboarding', { replace: true })
      } else {
        // Returning user — go straight to dashboard
        navigate('/dashboard', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0C0C14',
      gap: 16,
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '3px solid rgba(79,70,229,0.2)',
        borderTopColor: '#4F46E5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'system-ui' }}>
        Signing you in...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
