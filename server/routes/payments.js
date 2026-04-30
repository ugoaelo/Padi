import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { paymentLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { initializeTransaction, verifyTransaction, verifyWebhookSignature, issueRefund, getPaystackSubscription, cancelSubscription as cancelPaystackSubscription, SEMESTER_MONTHS as PAYSTACK_SEMESTER_MONTHS } from '../services/paystack.js'
import { activateSubscription, isRefundEligible, deactivateSubscription, getSubscriptionStatus, getFoundingMemberCount, extendSubscription, setGracePeriod, isFoundingMemberAvailable } from '../services/subscription.js'
import { sendPaymentFailedEmail, sendPauseConfirmationEmail, sendResumeConfirmationEmail, sendRenewalReminderEmail } from '../services/email.js'

const router = Router()

// ── Paystack webhook ──────────────────────────────────────────────
// Must stay before requireAuth — Paystack calls this without a user token
router.post('/webhooks/paystack', async (req, res) => {
  const signature = req.headers['x-paystack-signature']
  if (!verifyWebhookSignature(req.body, signature)) return res.status(400).json({ error: 'Invalid signature.' })
  try {
    if (req.body.event === 'charge.success') {
      const { metadata, amount, customer, paid_at } = req.body.data
      if (!metadata?.user_id) return res.json({ received: true }) // skip if no user_id
      const isSemester = metadata?.plan === 'semester'
      const periodEnd  = new Date(paid_at)
      periodEnd.setMonth(periodEnd.getMonth() + (isSemester ? PAYSTACK_SEMESTER_MONTHS : 1))
      await activateSubscription({
        userId:    metadata.user_id,
        provider:  'paystack',
        customerId: String(customer.id),
        amount:    amount / 100,
        periodEnd: periodEnd.toISOString(),
        planType:  isSemester ? 'semester' : 'monthly',
        planTier:  metadata.tier || 'base',
      })
    } else if (req.body.event === 'subscription.create') {
      // ── Store Paystack subscription code for future management ────
      // Fired when a plan-based subscription is created. We need the
      // subscription_code to disable (cancel) it later.
      const sub    = req.body.data
      const userId = sub.customer?.metadata?.user_id
      if (userId && sub.subscription_code) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ paystack_sub_code: sub.subscription_code, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
      }

    } else if (req.body.event === 'invoice.update') {
      // ── Paystack recurring renewal: extend period_end ─────────────
      // Fired when Paystack successfully charges a recurring plan subscription.
      // The charge.success fires too, but invoice.update carries the next
      // billing date explicitly — use it to keep current_period_end accurate.
      const invoice = req.body.data
      const userId  = invoice.customer?.metadata?.user_id
      if (userId && invoice.next_payment_date) {
        const newPeriodEnd = new Date(invoice.next_payment_date).toISOString()
        await extendSubscription(userId, newPeriodEnd)

        // ── Send renewal reminder email (non-blocking) ────────────
        // Tells the student their subscription renewed and when it renews next.
        try {
          const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
          const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, preferred_name, full_name').eq('id', userId).single()
          const { data: sub } = await supabaseAdmin.from('subscriptions').select('amount').eq('user_id', userId).single()
          if (authUser?.email) {
            sendRenewalReminderEmail({
              email:       authUser.email,
              firstName:   profile?.first_name,
              fullName:    profile?.full_name,
              renewalDate: newPeriodEnd,
              amount:      sub?.amount,
            }).catch(e => console.error('Renewal reminder email error (non-blocking):', e.message))
          }
        } catch (emailErr) {
          console.warn('Renewal reminder email setup error (non-blocking):', emailErr.message)
        }
      }

    } else if (req.body.event === 'subscription.disable') {
      const userId = req.body.data.customer?.metadata?.user_id
      if (userId) await deactivateSubscription(userId)

    } else if (req.body.event === 'charge.failed') {
      // ── Payment failed → open 3-day grace period ──────────────
      const userId = req.body.data.metadata?.user_id
      if (userId) {
        const gracePeriodEnd = await setGracePeriod(userId)
        // Send payment failed email (non-blocking)
        try {
          const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
          const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, full_name').eq('id', userId).single()
          if (authUser?.email) {
            sendPaymentFailedEmail({
              email:          authUser.email,
              firstName:      profile?.first_name,
              fullName:       profile?.full_name,
              gracePeriodEnd,
            }).catch(err => console.error('Payment failed email error (non-blocking):', err.message))
          }
        } catch (emailErr) {
          console.warn('Payment failed email setup error (non-blocking):', emailErr.message)
        }
      }
    }
    res.json({ received: true })
  } catch (err) {
    console.error('Paystack webhook error:', err)
    res.status(500).json({ error: 'Webhook processing failed.' })
  }
})

// ── Public: founding member count ─────────────────────────────────
// MUST stay before router.use(requireAuth) — called by the landing page
// without authentication (unauthenticated visitors need this data).
router.get('/founding-count', async (req, res) => {
  try {
    const count = await getFoundingMemberCount()
    res.json({ count, spotsRemaining: Math.max(0, 100 - count) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get founding count.' })
  }
})

// ── All routes below require authentication ───────────────────────
router.use(requireAuth)
router.use(paymentLimiter)

router.get('/status', async (req, res) => {
  try {
    const subscription = await getSubscriptionStatus(req.user.id)
    const { data: profile } = await supabaseAdmin.from('profiles').select('founding_member, locked_price').eq('id', req.user.id).single()
    res.json({ subscription, isFoundingMember: profile?.founding_member || false, lockedPrice: profile?.locked_price || null })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get subscription status.' })
  }
})

router.post('/paystack/initialize', async (req, res) => {
  try {
    const { plan = 'monthly', tier = 'base' } = req.body
    if (!['monthly', 'semester'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' })
    if (!['base', 'premium'].includes(tier)) return res.status(400).json({ error: 'Invalid tier.' })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('founding_member, locked_price, plan_tier')
      .eq('id', req.user.id)
      .single()

    // Decide pricing inputs for the wrapper:
    //   • Existing founding member → pass lockedPrice (renewal stays at locked rate forever)
    //   • New user + founding spots open → applyFoundingDiscount = true (first-month discount)
    //   • Otherwise → standard tier monthly price (wrapper default)
    // Semester ignores founding discount (handled inside wrapper).
    const isExistingFounding   = !!(profile?.founding_member && profile?.locked_price)
    const applyFoundingDiscount = !isExistingFounding && (await isFoundingMemberAvailable())

    const result = await initializeTransaction({
      email:                 req.user.email,
      userId:                req.user.id,
      plan,
      tier,
      lockedPrice:           isExistingFounding ? profile.locked_price : null,
      applyFoundingDiscount,
    })
    res.json(result)
  } catch (err) {
    console.error('Paystack init error:', err)
    res.status(500).json({ error: 'Failed to initialize payment.' })
  }
})

router.post('/paystack/verify', async (req, res) => {
  try {
    const { reference } = req.body
    if (!reference) return res.status(400).json({ error: 'Reference required.' })

    // If already active (webhook may have fired first), return status without re-activating
    const existing = await getSubscriptionStatus(req.user.id)
    if (existing?.status === 'active') {
      const { data: profile } = await supabaseAdmin.from('profiles').select('founding_member').eq('id', req.user.id).single()
      return res.json({ success: true, isFoundingMember: profile?.founding_member || false, alreadyActive: true })
    }

    // Webhook hasn't fired yet — verify and activate manually
    const transaction = await verifyTransaction(reference)
    if (transaction.status !== 'success') return res.status(400).json({ error: 'Payment was not successful.' })
    if (transaction.metadata?.user_id !== req.user.id) return res.status(403).json({ error: 'Payment reference mismatch.' })
    const isSemester = transaction.metadata?.plan === 'semester'
    const periodEnd  = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + (isSemester ? PAYSTACK_SEMESTER_MONTHS : 1))
    const result = await activateSubscription({
      userId:     req.user.id,
      provider:   'paystack',
      customerId: String(transaction.customerId),
      amount:     transaction.amount,
      periodEnd:  periodEnd.toISOString(),
      planType:   isSemester ? 'semester' : 'monthly',
      planTier:   transaction.metadata?.tier || 'base',
    })
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('Paystack verify error:', err)
    res.status(500).json({ error: 'Payment verification failed.' })
  }
})

router.post('/refund', async (req, res) => {
  try {
    const eligible = await isRefundEligible(req.user.id)
    if (!eligible) return res.status(400).json({ error: 'Refund window has expired.', code: 'REFUND_WINDOW_EXPIRED' })

    const subscription = await getSubscriptionStatus(req.user.id)

    // ── Paystack refund ───────────────────────────────────────────
    // Requires the original transaction ID — passed from client if available.
    // The client stores paystackTransactionId from the /verify response.
    if (subscription?.paystack_customer_id && req.body.paystackTransactionId) {
      await issueRefund({ transactionId: req.body.paystackTransactionId })
    }

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id)

    res.json({ success: true, message: 'Refund processed. Subscription cancelled.' })
  } catch (err) {
    console.error('Refund error:', err)
    res.status(500).json({ error: 'Refund failed. Contact support@yourpadi.com' })
  }
})

router.post('/cancel', async (req, res) => {
  try {
    const { reason, reasonDetail } = req.body
    const subscription = await getSubscriptionStatus(req.user.id)
    if (!subscription || subscription.status !== 'active') return res.status(400).json({ error: 'No active subscription to cancel.' })

    // ── Disable recurring Paystack subscription if one exists ──────
    if (subscription.paystack_sub_code) {
      try {
        const sub = await getPaystackSubscription(subscription.paystack_sub_code)
        if (sub?.email_token) {
          await cancelPaystackSubscription({
            subscriptionCode: subscription.paystack_sub_code,
            emailToken:       sub.email_token,
          })
        }
      } catch (psErr) {
        console.warn('Paystack subscription disable failed (non-fatal):', psErr.message)
        // Continue — Padi-side deactivation still runs
      }
    }
    await deactivateSubscription(req.user.id)

    // ── Save churn reason (non-blocking) ──────────────────────────
    if (reason) {
      const startDate = subscription.current_period_start
        ? new Date(subscription.current_period_start)
        : new Date()
      const monthsSubscribed = Math.max(1,
        Math.floor((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      )
      supabaseAdmin.from('cancellations').insert({
        user_id:          req.user.id,
        reason:           reason,
        reason_detail:    reasonDetail || null,
        months_subscribed: monthsSubscribed,
      }).then(({ error }) => {
        if (error) console.error('Churn reason save failed:', error.message)
      })
    }

    res.json({ success: true, message: 'Subscription cancelled.' })
  } catch (err) {
    console.error('Cancel error:', err)
    res.status(500).json({ error: 'Cancellation failed. Contact support@yourpadi.com' })
  }
})

// ── Pause subscription ────────────────────────────────────────────
// Blocks API access without cancelling. current_period_end is extended
// on resume so the student doesn't lose the time they paid for.
// Stripe: we call pause_collection so the next invoice is voided.
// Paystack: Padi-level only (no native pause API) — billing continues
//   but current_period_end is extended by the pause duration on resume.
//
// Pause durations: 1 | 2 | 3 months, or a specific ISO date.
// Body: { months?: 1 | 2 | 3 }   (default: 1)
router.post('/pause', async (req, res) => {
  try {
    const { months = 1 } = req.body
    if (![1, 2, 3].includes(Number(months))) {
      return res.status(400).json({ error: 'months must be 1, 2, or 3.' })
    }

    const subscription = await getSubscriptionStatus(req.user.id)
    if (!subscription) return res.status(400).json({ error: 'No active subscription.' })
    if (subscription.status !== 'active') return res.status(400).json({ error: 'Only active subscriptions can be paused.' })
    if (subscription.paused_until && new Date(subscription.paused_until) > new Date()) {
      return res.status(400).json({ error: 'Subscription is already paused.', code: 'ALREADY_PAUSED' })
    }

    const pausedUntil = new Date()
    pausedUntil.setMonth(pausedUntil.getMonth() + Number(months))

    // ── Record pause in DB ─────────────────────────────────────────
    const { error: dbErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        paused_until: pausedUntil.toISOString(),
        paused_at:    new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('user_id', req.user.id)

    if (dbErr) throw dbErr

    // ── Send pause confirmation email (non-blocking) ──────────────
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(req.user.id)
      const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, preferred_name, full_name').eq('id', req.user.id).single()
      if (authUser?.email) {
        sendPauseConfirmationEmail({
          email:         authUser.email,
          firstName:     profile?.first_name,
          preferredName: profile?.preferred_name,
          fullName:      profile?.full_name,
          pausedUntil:   pausedUntil.toISOString(),
          months:        Number(months),
        }).catch(e => console.error('Pause email error (non-blocking):', e.message))
      }
    } catch (emailErr) {
      console.warn('Pause email setup error (non-blocking):', emailErr.message)
    }

    res.json({
      success:     true,
      pausedUntil: pausedUntil.toISOString(),
      message:     `Subscription paused for ${months} month${months > 1 ? 's' : ''}. Access resumes automatically on ${pausedUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    })
  } catch (err) {
    console.error('Pause error:', err)
    res.status(500).json({ error: 'Failed to pause subscription. Contact support@yourpadi.com' })
  }
})

// ── Resume subscription ───────────────────────────────────────────
// Lifts the pause immediately. Extends current_period_end by the
// remaining pause time so the student gets the full benefit of their
// paid period. Stripe pause_collection is removed.
router.post('/resume', async (req, res) => {
  try {
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status, paused_until, paused_at, current_period_end')
      .eq('user_id', req.user.id)
      .single()

    if (!subscription) return res.status(400).json({ error: 'No subscription found.' })
    if (!subscription.paused_until || new Date(subscription.paused_until) <= new Date()) {
      return res.status(400).json({ error: 'Subscription is not currently paused.', code: 'NOT_PAUSED' })
    }

    // ── Calculate how much pause time remains → extend period_end ─
    const now           = new Date()
    const pausedUntil   = new Date(subscription.paused_until)
    const remainingMs   = pausedUntil.getTime() - now.getTime()
    const newPeriodEnd  = new Date(new Date(subscription.current_period_end).getTime() + remainingMs)

    // ── Clear pause, extend period_end in DB ──────────────────────
    const { error: dbErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        paused_until:       null,
        paused_at:          null,
        current_period_end: newPeriodEnd.toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq('user_id', req.user.id)

    if (dbErr) throw dbErr

    // ── Send resume confirmation email (non-blocking) ─────────────
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(req.user.id)
      const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, preferred_name, full_name').eq('id', req.user.id).single()
      if (authUser?.email) {
        sendResumeConfirmationEmail({
          email:         authUser.email,
          firstName:     profile?.first_name,
          preferredName: profile?.preferred_name,
          fullName:      profile?.full_name,
          newPeriodEnd:  newPeriodEnd.toISOString(),
        }).catch(e => console.error('Resume email error (non-blocking):', e.message))
      }
    } catch (emailErr) {
      console.warn('Resume email setup error (non-blocking):', emailErr.message)
    }

    res.json({
      success:         true,
      newPeriodEnd:    newPeriodEnd.toISOString(),
      message:         'Subscription resumed. Your access period has been extended to account for the pause.',
    })
  } catch (err) {
    console.error('Resume error:', err)
    res.status(500).json({ error: 'Failed to resume subscription. Contact support@yourpadi.com' })
  }
})

export default router
