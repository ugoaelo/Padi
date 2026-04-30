import 'dotenv/config'
import express from 'express'

// ── Validate required environment variables at startup ────────────
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'JWT_SECRET',
]
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length > 0) {
  console.error(`[STARTUP ERROR] Missing required environment variables:\n  ${missing.join('\n  ')}`)
  console.error('Server cannot start. Set the above variables and restart.')
  process.exit(1)
}
import cors from 'cors'
import helmet from 'helmet'
import { apiLimiter } from './middleware/rateLimiter.js'
import paymentRoutes  from './routes/payments.js'
import waitlistRoutes  from './routes/waitlist.js'
import aiRoutes        from './routes/ai.js'
import examRoutes      from './routes/exam.js'
import reviewRoutes    from './routes/review.js'
import adminRoutes     from './routes/admin.js'
import userRoutes      from './routes/user.js'
import contentRoutes   from './routes/content.js'

const app  = express()
const PORT = process.env.PORT || 4000

// ── CORS — allow both apex and www domains in production ──────────
const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://yourpadi.com',
  'https://www.yourpadi.com',
].filter(Boolean)

// ── Security headers ──────────────────────────────────────────────
// This is an API server — it returns JSON, not HTML.
// CSP here is set to 'none' because there is no content to load.
// The browser-facing CSP that actually protects users lives in
// client/vercel.json (applied by Vercel to every HTML/asset response).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'none'"],   // API returns JSON — no content loading
      frameAncestors: ["'none'"],   // nobody embeds this API in a frame
    },
  },
  hsts: {
    maxAge:            31536000,    // 1 year
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // Not required for a JSON API
}))
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header) and whitelisted domains
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

// ── Raw body needed for webhook signature verification ────────────
app.use('/api/payments/webhooks', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body
  req.body    = JSON.parse(req.body)
  next()
})

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use('/api', apiLimiter)

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/payments', paymentRoutes)
app.use('/api/waitlist', waitlistRoutes)
app.use('/api/ai',       aiRoutes)
app.use('/api/exam',     examRoutes)
app.use('/api/review',   reviewRoutes)
app.use('/api/admin',    adminRoutes)
app.use('/api/user',     userRoutes)
app.use('/api/content',  contentRoutes)

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }))

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

// ── Start server ──────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Padi server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

// ── Global request timeout — prevents hung requests from piling up ─
// AI calls have their own internal timeout (withTimeout in ai.js).
// This is the outer safety net for any other slow/hung operation.
server.setTimeout(15000, (socket) => {
  socket.destroy()
})

export default app
