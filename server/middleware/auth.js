import { supabaseAdmin } from '../db/supabase.js'

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorisation header.' })
    }
    const token = authHeader.split(' ')[1]
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token.' })
    }

    // ── Soft-delete check: block access for deleted accounts ──────
    // Accounts scheduled for deletion still hold a valid JWT but
    // must be denied access immediately on deletion request.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .single()

    if (profile?.deleted_at) {
      return res.status(403).json({
        error: 'This account has been scheduled for deletion. Check your email to reactivate within 30 days.',
        code:  'ACCOUNT_DELETED',
      })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(500).json({ error: 'Authentication failed.' })
  }
}

// ── requirePremium ────────────────────────────────────────────────────────────
// Must be used AFTER requireAuth (needs req.user).
// Blocks Base subscribers from Premium-only AI routes (Ask Padi, maths,
// study packs, summarise, refine, streaming).
export async function requirePremium(req, res, next) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan_tier')
      .eq('id', req.user.id)
      .single()

    if (profile?.plan_tier !== 'premium') {
      return res.status(403).json({
        error: 'This feature is available on the Premium plan. Upgrade to unlock it.',
        code:  'PREMIUM_REQUIRED',
      })
    }
    next()
  } catch (err) {
    console.error('Premium check error:', err)
    res.status(500).json({ error: 'Plan check failed.' })
  }
}

export async function requireSubscription(req, res, next) {
  try {
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status, current_period_end, grace_period_until, paused_until')
      .eq('user_id', req.user.id)
      .single()

    if (!subscription) {
      return res.status(403).json({ error: 'Active subscription required.', code: 'NO_SUBSCRIPTION' })
    }

    const now = new Date()

    // ── Paused subscription ────────────────────────────────────────
    // Student explicitly paused access; block with a clear message
    // so the client can show the resume button instead of an error.
    if (subscription.paused_until) {
      if (new Date(subscription.paused_until) >= now) {
        return res.status(403).json({
          error: 'Your subscription is paused.',
          code:  'SUBSCRIPTION_PAUSED',
          pausedUntil: subscription.paused_until,
        })
      } else {
        // ── Stale pause: auto-clear it (fire-and-forget) ────────────
        // paused_until is in the past — the pause expired naturally.
        // Clear it so future checks don't re-read the stale value.
        supabaseAdmin
          .from('subscriptions')
          .update({ paused_until: null, paused_at: null, updated_at: new Date().toISOString() })
          .eq('user_id', req.user.id)
          .then(({ error: clearErr }) => {
            if (clearErr) console.warn('Failed to auto-clear stale paused_until:', clearErr.message)
          })
      }
    }

    // ── Active subscription: status is active AND period has not ended ──
    const isActive = subscription.status === 'active'
      && new Date(subscription.current_period_end) >= now

    // ── Grace period: payment failed but 3-day window still open ──
    // Students keep access while we retry / they update their card.
    const isInGrace = subscription.status === 'past_due'
      && subscription.grace_period_until
      && new Date(subscription.grace_period_until) >= now

    if (!isActive && !isInGrace) {
      if (subscription.status === 'past_due') {
        return res.status(403).json({
          error: 'Your payment failed. Please update your payment method to continue.',
          code: 'PAYMENT_FAILED',
        })
      }
      return res.status(403).json({
        error: 'Your subscription has expired.',
        code: 'SUBSCRIPTION_EXPIRED',
      })
    }

    req.subscription = subscription
    req.inGracePeriod = isInGrace // routes can optionally warn the user
    next()
  } catch (err) {
    console.error('Subscription middleware error:', err)
    res.status(500).json({ error: 'Subscription check failed.' })
  }
}
