import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { identifyUser, resetAnalytics } from '../lib/analytics.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Fetch user profile from DB ──────────────────────────────────
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) setProfile(data)
    return data
  }

  // ── Listen for auth state changes ───────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      setLoading(false)
    })

    // Subscribe to changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const p = await fetchProfile(session.user.id)
          identifyUser(session.user.id, {
            email:           session.user.email,
            university:      p?.university,
            course:          p?.course,
            founding_member: p?.founding_member ?? false,
          })
        } else {
          setProfile(null)
          resetAnalytics()
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Auth methods ─────────────────────────────────────────────────

  const signUpWithEmail = async ({ email, password, firstName, lastName, preferredName, dob, university, course, whatsapp }) => {
  const fullName = `${firstName} ${lastName}`.trim()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error

  if (data.user) {
    await supabase.from('profiles').insert({
      id:             data.user.id,
      email,
      full_name:      fullName,
      first_name:     firstName,
      last_name:      lastName,
      preferred_name: preferredName || null,
      dob,
      university,
      course,
      whatsapp:       whatsapp || null,
      founding_member: false,
      locked_price:   null,
    })
  }
  return data
}

  const signInWithEmail = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw error
    return data
  }

  const signInWithApple = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const updateProfile = async (updates) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (error) throw error
    const fresh = await fetchProfile(user.id)
    return fresh
  }

  // Sends a confirmation link to the new address.
  // The change only takes effect once the user clicks that link.
  const updateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
  }

  // ── Derived state ────────────────────────────────────────────────
  const isAuthenticated  = !!user
  const needsOnboarding  = isAuthenticated && profile && !profile.university

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAuthenticated,
      needsOnboarding,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signInWithApple,
      signOut,
      sendPasswordReset,
      updatePassword,
      updateProfile,
      updateEmail,
      fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
