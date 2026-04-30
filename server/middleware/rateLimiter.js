import rateLimit from 'express-rate-limit'

// ── STORE NOTE ────────────────────────────────────────────────────────────────
// All limiters below use the default in-memory store (MemoryStore).
// This is correct and safe for a single Railway instance at launch.
//
// When you scale to multiple Railway instances, rate limits become per-process
// (each instance has its own counter) and users can bypass them by hitting
// different instances. At that point, switch to a Redis-backed store:
//
//   npm install rate-limit-redis ioredis
//
//   import { RedisStore } from 'rate-limit-redis'
//   import Redis from 'ioredis'
//   const redis = new Redis(process.env.REDIS_URL)
//
//   Then add to each limiter:
//   store: new RedisStore({ sendCommand: (...args) => redis.call(...args) })
//
// Add REDIS_URL to Railway env vars when the time comes.
// Until then, leave this file as-is.
// ─────────────────────────────────────────────────────────────────────────────

// ── Global API limiter ────────────────────────────────────────────
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
})

// ── Auth endpoint limiter ─────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
})

// ── AI burst limiter: 5 requests per minute per user ─────────────
// Prevents rapid-fire requests within a single session.
// This is a BURST limiter, not a monthly cost cap — caching + model
// selection are the primary cost controls (see CLAUDE.md for analysis).
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: "You're generating a lot — take a 60 second breather and continue.", retryAfter: 60 },
})

// ── AI daily limiter: 40 AI requests per 24 hours per user ───────
// Secondary cost control layer. At ~$0.004/call and 40 calls/day,
// worst-case daily spend is ~$0.16/user/day ($4.80/month) before caching.
// With 35-50% cache hit rate the effective cost is well under the ₦550 target.
// Increase this cap as cache grows and you confirm costs are under control.
export const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `daily:${req.user?.id || req.ip}`,
  message: { error: "You've used all 40 study sessions for today — your limit resets at midnight. Review your saved library or flashcards in the meantime!", code: 'DAILY_LIMIT_REACHED', retryAfter: 86400 },
})

// ── Payment endpoint limiter ──────────────────────────────────────
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again later.' },
})

// ── Waitlist submission limiter ───────────────────────────────────
export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Please try again later.' },
})
