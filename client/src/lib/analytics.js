// ── Padi Analytics — thin Posthog wrapper ────────────────────────────────────
// Import this file anywhere you want to track an event.
// All calls are no-ops if Posthog hasn't been initialised (e.g. missing key).
//
// Usage:
//   import { track } from '../lib/analytics.js'
//   track('exam_completed', { score: 82, subject: 'Physics' })

import posthog from 'posthog-js'

const KEY  = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

export function initAnalytics() {
  if (!KEY) return // silently skip in dev if key isn't set
  posthog.init(KEY, {
    api_host:           HOST,
    autocapture:        true,   // clicks, inputs, pageviews auto-tracked
    capture_pageview:   true,
    persistence:        'localStorage',
    // Don't capture anything from the admin route
    url_allowlist:      [window.location.origin],
  })
}

// Call on login — ties all future events to this user
export function identifyUser(userId, traits = {}) {
  if (!KEY) return
  posthog.identify(userId, traits)
}

// Call on logout — separates this session from the next
export function resetAnalytics() {
  if (!KEY) return
  posthog.reset()
}

// General event tracker
export function track(event, properties = {}) {
  if (!KEY) return
  posthog.capture(event, properties)
}

// ── Pre-named events — use these for consistency ──────────────────────────────
// Keeping names in one place means your Posthog dashboard stays clean.

export const Events = {
  // Auth
  SIGNED_UP:              'signed_up',
  LOGGED_IN:              'logged_in',

  // AI usage
  AI_QUESTION_ASKED:      'ai_question_asked',       // { subject, university }
  STUDY_PACK_GENERATED:   'study_pack_generated',    // { subject }
  NOTES_SUMMARISED:       'notes_summarised',
  PAST_PAPER_ANALYSED:    'past_paper_analysed',
  AI_LIMIT_REACHED:       'ai_daily_limit_reached',

  // Exams
  EXAM_STARTED:           'exam_started',            // { subject, question_count }
  EXAM_COMPLETED:         'exam_completed',          // { subject, score, passed }

  // Payments
  PAYMENT_INITIATED:      'payment_initiated',       // { provider, plan }
  PAYMENT_COMPLETED:      'payment_completed',       // { provider, plan, amount }
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',  // { reason, months_subscribed }

  // Engagement
  LIBRARY_ITEM_SAVED:     'library_item_saved',
  DOCUMENT_UPLOADED:      'document_uploaded',
  REVIEW_SESSION_DONE:    'review_session_done',     // { cards_reviewed }
}
