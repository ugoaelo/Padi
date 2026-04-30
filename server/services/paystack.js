import crypto from 'crypto'
import 'dotenv/config'
import { PLAN_PRICES } from './subscription.js'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder'
const PAYSTACK_BASE   = 'https://api.paystack.co'

async function paystackRequest(method, path, body = null) {
  const options = {
    method,
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
  }
  if (body) options.body = JSON.stringify(body)
  const res  = await fetch(`${PAYSTACK_BASE}${path}`, options)
  const data = await res.json()
  if (!data.status) throw new Error(data.message || 'Paystack request failed')
  return data.data
}

// Semester = 4 months access at the tier semester price (e.g. Base ₦10,000, Premium ₦16,000)
export const SEMESTER_MONTHS = 4

// ── Resolve charge amount in NGN ──────────────────────────────────
// Priority order:
//   1. Semester plan → tier semester price (founding discount does NOT apply to semester)
//   2. lockedPrice present → existing founding member renewal at locked rate
//   3. applyFoundingDiscount → first-month founding price for new eligible signup
//   4. Default → tier monthly price
function resolveAmount({ plan, tier, lockedPrice, applyFoundingDiscount }) {
  const prices = PLAN_PRICES[tier] || PLAN_PRICES.base
  if (plan === 'semester')         return prices.semester
  if (lockedPrice)                 return lockedPrice
  if (applyFoundingDiscount)       return prices.founding_month1
  return prices.monthly
}

// ── Plan codes (set in Paystack dashboard, stored as env vars) ──────
// When present, Paystack attaches the customer to the plan and handles
// recurring monthly billing automatically.
// Semester charges are one-time (no plan code) — students re-subscribe manually.
// Founding-discount first months are also one-time (plan attached on next renewal).
const PLAN_CODES = {
  base:    process.env.PAYSTACK_BASE_PLAN_CODE    || null,
  premium: process.env.PAYSTACK_PREMIUM_PLAN_CODE || null,
}

export async function initializeTransaction({
  email,
  userId,
  plan = 'monthly',          // 'monthly' | 'semester'
  tier = 'base',             // 'base' | 'premium'
  lockedPrice = null,        // existing founding member's locked NGN price
  applyFoundingDiscount = false, // true = first-month founding signup
}) {
  const amount = resolveAmount({ plan, tier, lockedPrice, applyFoundingDiscount })

  const payload = {
    email,
    amount:   amount * 100, // kobo
    currency: 'NGN',
    metadata: {
      user_id:                  userId,
      plan,
      tier,
      applied_founding_discount: applyFoundingDiscount,
      locked_price:             lockedPrice,
    },
    callback_url: `${process.env.CLIENT_URL}/payment/verify`,
  }

  // ── Attach Paystack Plan for regular monthly subscriptions ────────
  // Skip plan attachment for: semester (one-time), founding first-month
  // (discounted price doesn't match plan amount), locked-price renewals.
  // Once plan codes are set in env, recurring billing is automatic.
  const planCode = PLAN_CODES[tier]
  const isRegularMonthly = plan === 'monthly' && !lockedPrice && !applyFoundingDiscount
  if (isRegularMonthly && planCode) {
    payload.plan = planCode
    // When a plan is attached, Paystack ignores the `amount` field and
    // uses the plan's amount. Remove it to avoid confusing Paystack.
    delete payload.amount
  }

  const data = await paystackRequest('POST', '/transaction/initialize', payload)
  return {
    authorizationUrl: data.authorization_url,
    reference:        data.reference,
    accessCode:       data.access_code,
    plan,
    tier,
    amount,
  }
}

// ── Fetch a Paystack subscription (to get email token for disable) ──
export async function getPaystackSubscription(subscriptionCode) {
  return paystackRequest('GET', `/subscription/${subscriptionCode}`)
}

export async function verifyTransaction(reference) {
  const data = await paystackRequest('GET', `/transaction/verify/${reference}`)
  return {
    status:        data.status,
    amount:        data.amount / 100,
    reference:     data.reference,
    customerId:    data.customer?.id,
    customerEmail: data.customer?.email,
    metadata:      data.metadata,
    paidAt:        data.paid_at,
  }
}

export async function cancelSubscription({ subscriptionCode, emailToken }) {
  return paystackRequest('POST', '/subscription/disable', { code: subscriptionCode, token: emailToken })
}

export async function issueRefund({ transactionId, amount }) {
  return paystackRequest('POST', '/refund', { transaction: transactionId, amount: amount ? amount * 100 : undefined })
}

export function verifyWebhookSignature(payload, signature) {
  if (!signature) return false
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET || 'placeholder')
    .update(JSON.stringify(payload))
    .digest('hex')
  return hash === signature
}
