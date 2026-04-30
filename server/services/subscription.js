import { supabaseAdmin } from '../db/supabase.js'
import { sendWelcomeEmail } from './email.js'

const FOUNDING_MEMBER_LIMIT  = 100
const FOUNDING_PRICE_BASE    = 3000   // locked price for founding Base members forever
const FOUNDING_PRICE_PREMIUM = 4500   // locked price for founding Premium members forever

// Plan pricing — NGN. Semester is a one-time charge for 4 months access.
// Founding discount applies only to monthly first-month signups (not semester).
export const PLAN_PRICES = {
  base:    { monthly: 3000, founding_month1: 1500, semester: 10000 },
  premium: { monthly: 7000, founding_month1: 2500, semester: 22000 },
}

// Solve credits per tier
export const SOLVE_CREDITS = {
  base:    3,
  premium: 5,
}

// ── Get current founding member count ────────────────────────────
export async function getFoundingMemberCount() {
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('founding_member', true)
  return count || 0
}

// ── Check if founding spots are still available ───────────────────
export async function isFoundingMemberAvailable() {
  const count = await getFoundingMemberCount()
  return count < FOUNDING_MEMBER_LIMIT
}

// ── Activate subscription after successful payment ────────────────
// Safe to call multiple times (upsert) — idempotent by design.
// Preserves the original refund window on re-calls (webhook + client verify).
// Uses atomic DB function to claim founding member status — no race condition.
export async function activateSubscription({
  userId,
  provider,          // 'paystack' | 'stripe'
  customerId,
  subscriptionCode,  // Paystack sub code
  stripeSubId,       // Stripe subscription ID
  amount,
  periodEnd,
  planType = 'monthly', // 'monthly' | 'semester'
  planTier = 'base',    // 'base' | 'premium'
}) {
  // Check existing subscription — preserve refund window and detect first activation
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('status, refund_eligible_until')
    .eq('user_id', userId)
    .single()

  const isFirstActivation = !existing || existing.status !== 'active'
  // Preserve original refund window — don't reset on webhook re-fire
  const refundEligibleUntil = existing?.refund_eligible_until
    || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  // Upsert subscription record
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id:               userId,
      status:                'active',
      plan:                  'monthly',
      plan_type:             planType,
      amount,
      paystack_customer_id:  provider === 'paystack' ? customerId      : null,
      paystack_sub_code:     provider === 'paystack' ? subscriptionCode : null,
      stripe_customer_id:    provider === 'stripe'   ? customerId      : null,
      stripe_sub_id:         provider === 'stripe'   ? stripeSubId     : null,
      current_period_start:  new Date().toISOString(),
      current_period_end:    periodEnd,
      refund_eligible_until: refundEligibleUntil,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw error

  // ── Set plan tier on profile ──────────────────────────────────
  await supabaseAdmin
    .from('profiles')
    .update({ plan_tier: planTier })
    .eq('id', userId)

  // ── Atomic founding member claim via Postgres function ────────
  // The DB function does the count-check and UPDATE in a single statement,
  // eliminating the TOCTOU race condition at the 100th spot.
  let isFoundingMember = false
  try {
    const { data: claimed } = await supabaseAdmin.rpc('claim_founding_member', { p_user_id: userId })
    isFoundingMember = claimed === true
    // Store tier-appropriate locked price
    if (isFoundingMember) {
      await supabaseAdmin
        .from('profiles')
        .update({ locked_price: planTier === 'premium' ? FOUNDING_PRICE_PREMIUM : FOUNDING_PRICE_BASE })
        .eq('id', userId)
    }
  } catch (err) {
    console.warn('Founding member claim failed (non-blocking):', err.message)
  }

  // ── Send welcome email on first activation only ───────────────
  if (isFirstActivation) {
    try {
      // Get email from Supabase Auth (always reliable, even before profile is complete)
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
      const { data: profile } = await supabaseAdmin.from('profiles').select('first_name, full_name').eq('id', userId).single()
      if (authUser?.email) {
        sendWelcomeEmail({
          email:     authUser.email,
          firstName: profile?.first_name,
          fullName:  profile?.full_name,
        }).catch(err => console.error('Welcome email failed (non-blocking):', err.message))
      }
    } catch (err) {
      console.warn('Welcome email setup failed (non-blocking):', err.message)
    }
  }

  const lockedPrice = isFoundingMember
    ? (planTier === 'premium' ? FOUNDING_PRICE_PREMIUM : FOUNDING_PRICE_BASE)
    : null
  return { isFoundingMember, lockedPrice, planTier }
}

// ── Check if user is within 48hr refund window ────────────────────
export async function isRefundEligible(userId) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('refund_eligible_until, status')
    .eq('user_id', userId)
    .single()
  if (!data || data.status !== 'active') return false
  return new Date(data.refund_eligible_until) > new Date()
}

// ── Mark payment as failed + open 3-day grace period ─────────────
// Called by payment failure webhooks. Students keep access for 3 days
// while the payment is retried or they update their card.
export async function setGracePeriod(userId) {
  const gracePeriodUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status:             'past_due',
      grace_period_until: gracePeriodUntil,
      updated_at:         new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
  return gracePeriodUntil
}

// ── Deactivate subscription ───────────────────────────────────────
export async function deactivateSubscription(userId) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw error
}

// ── Get user subscription status ─────────────────────────────────
export async function getSubscriptionStatus(userId) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data || null
}

// ── Extend subscription period on renewal ────────────────────────
// Called by renewal webhook handlers (Stripe invoice.payment_succeeded, etc.)
export async function extendSubscription(userId, newPeriodEnd) {
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status:             'active',
      current_period_end: newPeriodEnd,
      updated_at:         new Date().toISOString(),
    })
    .eq('user_id', userId)
}
