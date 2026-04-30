import { supabase } from './supabase.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// ── Helper: get auth token for API calls ─────────────────────────
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

// ── Helper: authenticated fetch (10 s timeout) ────────────────────
async function authFetch(path, options = {}) {
  const token      = await getAuthToken()
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) {
      // ── Broadcast pause/delete codes so the shell can react ──────
      if (data.code === 'SUBSCRIPTION_PAUSED') {
        window.dispatchEvent(new CustomEvent('padi:subscription-paused', { detail: { pausedUntil: data.pausedUntil } }))
      }
      if (data.code === 'ACCOUNT_DELETED') {
        window.dispatchEvent(new CustomEvent('padi:account-deleted'))
      }
      const err    = new Error(data.error || 'Request failed')
      err.code     = data.code || null
      err.pausedUntil = data.pausedUntil || null
      throw err
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — check your connection')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ── Get subscription status ───────────────────────────────────────
export async function getSubscriptionStatus() {
  return authFetch('/api/payments/status')
}

// ── Get founding member count (public) ───────────────────────────
export async function getFoundingCount() {
  const res  = await fetch(`${API_URL}/api/payments/founding-count`)
  const data = await res.json()
  return data
}

// ── Initialize Paystack payment ───────────────────────────────────
// options: { plan?: 'monthly' | 'semester', tier?: 'base' | 'premium' }
export async function initializePaystackPayment(options = {}) {
  return authFetch('/api/payments/paystack/initialize', {
    method: 'POST',
    body:   JSON.stringify(options),
  })
}

// ── Verify Paystack payment after redirect ────────────────────────
export async function verifyPaystackPayment(reference) {
  return authFetch('/api/payments/paystack/verify', {
    method: 'POST',
    body:   JSON.stringify({ reference }),
  })
}

// ── Request refund ────────────────────────────────────────────────
export async function requestRefund() {
  return authFetch('/api/payments/refund', { method: 'POST' })
}

// ── Cancel subscription (with optional churn reason) ─────────────
export async function cancelSubscription({ reason, reasonDetail } = {}) {
  return authFetch('/api/payments/cancel', {
    method: 'POST',
    body:   JSON.stringify({ reason, reasonDetail }),
  })
}

// ── Initialize Paystack semester payment ──────────────────────────
export async function initializeSemesterPayment() {
  return authFetch('/api/payments/paystack/initialize', {
    method: 'POST',
    body:   JSON.stringify({ plan: 'semester' }),
  })
}

// ── User progress stats ───────────────────────────────────────────
export async function getUserProgress() {
  return authFetch('/api/user/progress')
}

// ── Save user preferences (last topic, AI counter) ────────────────
export async function saveUserPreferences(prefs) {
  return authFetch('/api/user/preferences', {
    method: 'POST',
    body:   JSON.stringify(prefs),
  })
}

// ── Delete own account (soft delete, 30-day reactivation window) ─
export async function deleteAccount() {
  return authFetch('/api/user/account', { method: 'DELETE' })
}

// ── Pause subscription ────────────────────────────────────────────
// months: 1 | 2 | 3 — how long to block access (period_end extended on resume)
export async function pauseSubscription(months = 1) {
  return authFetch('/api/payments/pause', {
    method: 'POST',
    body:   JSON.stringify({ months }),
  })
}

// ── Resume subscription early (before paused_until) ──────────────
export async function resumeSubscription() {
  return authFetch('/api/payments/resume', { method: 'POST' })
}

// ── Join waitlist (no auth needed) ───────────────────────────────
export async function joinWaitlist(formData) {
  const res = await fetch(`${API_URL}/api/waitlist`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(formData),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to join waitlist')
  return data
}
