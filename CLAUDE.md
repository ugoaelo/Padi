# CLAUDE.md — Padi Project Context

This file gives AI assistants full context about the Padi codebase so they can help effectively without needing to be re-explained every session.

---

## What is Padi?

**Padi: Your AI Study Partner** — an AI-powered exam prep platform for Nigerian university students (primary) and secondary school students (secondary).

Built by **Ugochukwu Michael-Ogbonna** under parent company **Syca Works Ltd**.

**Domain:** yourpadi.com (Namecheap)
**Support email:** support@yourpadi.com
**Brand email:** hello@yourpadi.com
**Pricing (two tiers):**
- Base: ₦3,000/month (~$2 USD) | $2 USD/month via Stripe — 3 TQ solves per course per semester
- Premium: ₦7,000/month (~$4.50 USD) | $4.50 USD/month via Stripe — 5 TQ solves per course per semester
- First cohort (first 100 paying): ₦1,500 (Base) / ₦2,500 (Premium) first month, then locked forever at ₦3,000 (Base) / ₦4,500 (Premium) per month
- Semester bundle: ₦10,000 (Base) / ₦22,000 (Premium) for 4 months | $7/$16 USD via Stripe
**Refund policy:** 48-hour full refund, no questions asked.
**No free tier.** (Consider adding later when user base is established)
**Grace period:** 3 days on payment failure before access is paused.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| AI | Anthropic API (claude-haiku-4-5-20251001 for most tasks, claude-sonnet-4-6 for complex) |
| Web Search | Tavily API (RAG-optimised; free tier 1,000 searches/month) — fallback on Ask page |
| Analytics | PostHog (event tracking + session replay; initialised in main.jsx via `initAnalytics()`) |
| Payments | Paystack (Nigeria + international cards) |
| Email | Resend |
| Deployment | Vercel (frontend) + Railway (backend) |
| Storage | Cloudflare R2 |
| File Parsing | mammoth (client-side .docx/.doc) + pdf-parse (server-side PDF via `/api/ai/extract-text`) |
| File Upload | multer (server multipart middleware; memoryStorage; 10 MB limit) |
| Image Storage | Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible); `server/services/storage.js`; `uploadToR2(buffer, mimeType, folder)` |

---

## Project Structure

```
padi/
├── client/                          # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── layout/AppShell.jsx  # Sidebar navigation
│       │   ├── ui/AIResponseCard    # AI response with actions
│       │   ├── ui/StudyPackCard     # Tabbed study pack viewer
│       │   ├── ui/SupportWidget     # Floating support button
│       │   ├── ui/PWAInstallPrompt  # Add to home screen
│       │   ├── Navbar.jsx           # Landing page nav
│       │   ├── Hero.jsx             # Hero with founding counter
│       │   └── WaitlistForm.jsx     # First cohort signup form
│       ├── context/AuthContext.jsx  # Auth state + all auth methods
│       ├── lib/
│       │   ├── supabase.js          # Supabase client
│       │   ├── api.js               # Payment + user progress API calls (10s AbortController timeout)
│       │   ├── aiApi.js             # All AI + exam + review API calls (10s timeout; extractPdfText; quota tracking)
│       │   └── fileParser.js        # Shared file parsing: .txt → text(), .docx → mammoth, .pdf → server endpoint
│       ├── pages/
│       │   ├── LandingPage          # Marketing + first cohort form
│       │   ├── LoginPage            # Email + Google OAuth
│       │   ├── SignupPage           # 2-step signup (step 2 skipped if from waitlist)
│       │   ├── OnboardingPage       # OAuth profile completion
│       │   ├── DashboardPage        # Home screen
│       │   ├── AskPage              # Topic learning + math solver
│       │   ├── StudyPacksPage       # Study pack generator
│       │   ├── ExamPage             # Exam simulation
│       │   ├── PastQuestionsPage    # Past paper analysis
│       │   ├── LibraryPage          # Offline library
│       │   ├── ReviewPage           # Spaced repetition (SM-2)
│       │   ├── AdminPage            # Super admin panel
│       │   ├── PricingPage          # Paystack + Stripe checkout
│       │   ├── PaymentSuccessPage   # Post-payment
│       │   ├── PasswordPages.jsx    # Forgot/reset password
│       │   └── App.jsx              # Also contains PolicyPage (privacy + terms stubs)
│       └── styles/globals.css       # Design tokens
│
├── server/                          # Node.js + Express backend
│   ├── routes/
│   │   ├── ai.js        # /explain /math /study-pack /summarise /refine /flag /save-to-library /library /ask/stream
│   │   ├── exam.js      # /generate /submit /history /past-questions/analyse /predict
│   │   ├── payments.js  # Paystack + Stripe + webhooks + refund + cancel
│   │   ├── review.js    # SM-2 items/stats/answer/schedule/recall
│   │   ├── waitlist.js  # POST /api/waitlist — saves to DB + sends Resend email
│   │   ├── user.js      # /progress /preferences /account (DELETE soft-delete) /reactivate/:token (public)
│   │   └── admin.js     # Stats/users/waitlist/flagged/batch-upload/knowledge-base + students CRUD
│   ├── services/
│   │   ├── ai.js           # Anthropic API — callAI, generateAnswer, solveMath, etc.
│   │   ├── userContext.js  # KB + user document context injection helpers
│   │   ├── exam.js         # Exam generation + grading + past question analysis
│   │   ├── spaced.js       # SM-2 algorithm + recall questions
│   │   ├── email.js        # Resend — sendWaitlistEmail, sendWelcomeEmail
│   │   ├── paystack.js     # Paystack API wrapper
│   │   ├── stripe.js       # Stripe API wrapper
│   │   ├── webSearch.js    # Tavily web search — searchWeb(), formatWebContext()
│   │   └── subscription.js # Founding member logic + subscription management
│   └── middleware/
│       ├── auth.js         # requireAuth, requireSubscription
│       └── rateLimiter.js  # apiLimiter, aiLimiter, aiDailyLimiter, paymentLimiter, waitlistLimiter
│
└── supabase/schema.sql     # Full database schema + migrations section at bottom
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles — first_name, last_name, preferred_name, email, dob, university, course, founding_member, locked_price, is_admin, deleted_at, deletion_token, deletion_token_expires_at, summer_semester |
| `waitlist` | First cohort signups — full_name, email, dob, university, course, whatsapp |
| `subscriptions` | Active subscriptions — Paystack + Stripe IDs, status, plan_type, grace_period_until, refund window, paused_until, paused_at |
| `study_packs` | Generated study packs per user |
| `library_items` | Saved content for offline access |
| `exam_sessions` | Exam simulation history + scores (completed_at is NULL until submitted) |
| `review_items` | Spaced repetition queue (SM-2 fields) |
| `flagged_answers` | User-flagged AI responses for admin review |
| `ai_cache` | Cached AI responses to reduce API costs |
| `knowledge_base` | Admin-uploaded documents to enrich AI |
| `user_documents` | Per-user document summaries gleaned from uploads — used to personalise AI answers with the student's own course material without sharing across users |
| `cancellations` | Churn reason tracking — reason, reason_detail, months_subscribed. Admin-only read. |
| `user_preferences` | Per-user preferences — last_topic, last_section, ai_calls_today, ai_calls_date, session_banner_dismissed_year (for resume + quota display + annual banner) |

---

## Key Business Logic

### Founding Member / First Cohort
- First 100 **paying** users are founding members
- Tracked by `founding_member = true` in `profiles` table
- Counter comes from `/api/payments/founding-count` (public — no auth required)
- Before 100 payments: landing page shows first cohort form, ₦1,500 first month
- After 100 payments: first cohort section replaced with standard ₦3,000 signup
- Founding members' price locked at ₦3,000 forever even if prices rise
- **Atomic claim**: the `claim_founding_member(user_id)` Postgres function handles the count-check and profile update in a single SQL statement — no race condition at the 100th spot

### Name Logic
- `first_name` + `last_name` stored separately
- `preferred_name` optional — "what should Padi call you?"
- Display priority: `preferred_name` → `first_name` → `full_name.split(' ')[0]`
- Used in dashboard greeting, emails, all personalised copy

### AI Cost Control
- **Target:** ₦550/student/month AI costs (ceiling ₦800, floor ₦300 as cache grows)
- **Cost analysis:** At typical student usage (~60–90 AI calls/month) with 35–50% cache hit rate, effective API calls drop to ~40–60/month. At ~$0.004/blended call (85% Haiku + 15% Sonnet), cost lands at $0.16–0.24/student/month ≈ ₦260–390. Well within target once cache matures.
- **Burst limiter:** 5 AI requests per minute per user (`aiLimiter`) — burst protection, not the primary cost lever
- **Daily limiter:** 40 AI requests per 24 hours per user (`aiDailyLimiter`) — secondary cost cap; raise if users are hitting it legitimately
- **Model selection:** Haiku for most tasks, Sonnet for complex (exam generation, past question analysis, math)
- **Caching:** All cacheable responses stored in `ai_cache` (hash of taskType + systemPrompt + userPrompt)
- **Privacy rule:** AI responses are NOT cached when user-specific document context is injected (prevents one user's content leaking into another's cache entry)
- **Timeout:** AI calls have a 9-second hard timeout (`withTimeout` in services/ai.js) — fast failure on Anthropic API issues
- **Future:** If costs exceed ceiling, consider: (1) reducing daily cap, (2) adding a knowledge_base semantic search to avoid redundant AI calls for well-covered topics, (3) upgrading to Redis-backed rate limiters when scaling to multiple Railway instances

### Knowledge Base & User Document Gleaning
- **Admin uploads** → `knowledge_base` table. These enrich ALL users' study packs and answers for the relevant subject (injected via `getKnowledgeBaseContext` in ai service).
- **User uploads** → when a user summarises or uploads a document, the summary is automatically saved to `user_documents`. Future AI calls for that user inject this context personalising answers to their actual course material. **This is the main mechanism for reducing AI costs over time** — once a user has uploaded their course material, subsequent questions about the same topic get enriched context without re-uploading.
- User document context is **never shared across users** (privacy rule) and is never cached alongside generic AI responses.
- Knowledge base context is shared and cached — it's admin-curated educational content.

### Grace Period (Payment Failure)
- When a payment fails (Stripe `invoice.payment_failed` or Paystack `charge.failed`), `setGracePeriod(userId)` is called
- Sets subscription `status = 'past_due'` with `grace_period_until = NOW() + 3 days`
- `requireSubscription` middleware lets `past_due` users through if `grace_period_until` is in the future
- A payment failed email fires immediately via `sendPaymentFailedEmail`
- After grace period, access pauses — user must re-subscribe via `/pricing`

### Cancellation & Churn Tracking
- Cancel route (`POST /api/payments/cancel`) accepts optional `{ reason, reasonDetail }` body
- Saves to `cancellations` table (non-blocking, fire-and-forget)
- Frontend: `CancellationModal.jsx` is a 3-step flow: reason selection → confirmation → done
- Admin can query `cancellations` table to see churn patterns

### Semester Bundle (4-month plan)
- Paystack: ₦10,000 one-time (vs ₦12,000 at monthly rate). `plan = 'semester'` in metadata.
- `activateSubscription` stores `plan_type = 'semester'` and sets `current_period_end` to +4 months.
- Semester subscribers don't auto-renew — they must manually re-subscribe after 4 months.
- Renewal reminders should be sent 7 days before semester ends (via Paystack webhook or manual email).

### Renewal Emails
- `sendPaymentFailedEmail` — triggered by Paystack `charge.failed` webhook; opens 3-day grace period
- `sendRenewalReminderEmail` — available in email.js; hook into Paystack recurring plan events once Plans are set up
- Stripe removed — Paystack is the sole payment provider (accepts Nigerian + international cards)

### Progress Signals & Resume
- `GET /api/user/progress` — returns exam stats, topics uploaded, review due count, last topic/section, AI quota
- `POST /api/user/preferences` — saves last active topic + section + increments AI daily counter
- Dashboard shows: resume card, stats grid, AI quota bar (colour-coded: blue → amber → red as depleted)
- AI quota display: reads from `padi_ai_remaining` in sessionStorage, updated via `padi:ai-remaining` custom events

### Refund Policy
- 48-hour window from first payment
- Stored as `refund_eligible_until` in `subscriptions` — preserved across webhook re-fires (idempotent)
- Both Paystack (`issueRefund`) and Stripe (`issueStripeRefund`) refund flows are wired up
- Paystack refund requires the original transaction ID (`paystackTransactionId`) from the client

### Subscription Renewals
- **Stripe:** `invoice.payment_succeeded` webhook extends `current_period_end` monthly. Without this, subscribers lose access after month 1 even if they keep paying.
- **Paystack:** Requires Paystack Plans to be set up for true auto-renewal. Currently handles one-time charges + `charge.success` webhook. Set up a Paystack Plan for recurring billing before launch.

### Exam Submission Latency
- Short-answer AI grading now runs in **parallel** (`Promise.all`) — latency drops from ~10s (5 sequential calls) to ~2s regardless of question count.

### NDPA 2023 Compliance — Account Deletion (Right to Erasure)
- Soft-delete pattern: `deleted_at` timestamp on `profiles`. Auth middleware checks this on every authenticated request and returns 403 `ACCOUNT_DELETED` if set.
- Student-initiated deletion: `DELETE /api/user/account` sets `deleted_at = NOW()`, generates a `deletion_token` (crypto.randomBytes 32-byte URL-safe string), stores `deletion_token_expires_at = NOW() + 30 days`, sends a reactivation email.
- Reactivation: `GET /api/user/reactivate/:token` — **public route, placed BEFORE `router.use(requireAuth)`**. Validates token + expiry, clears `deleted_at`. Redirects to `/login?reactivate=success|invalid|expired|already-active`.
- Permanent wipe: handled by manual action or a cron job after 30 days. `sendAccountPermanentlyDeletedEmail` is available for post-wipe notification.
- `deleteAccount()` in `api.js` — `DELETE /api/user/account` — no body required.
- `sendAccountDeletionEmail` and `sendAccountPermanentlyDeletedEmail` in `server/services/email.js`.
- `SERVER_URL` env var required in Railway for the reactivation URL to work in production (see Environment Variables section).
- 3-step confirmation UI in AccountPage: "Delete my account" → type "DELETE" → final confirm showing user's email.

### NDPA 2023 Compliance — Consent at Signup
- Mandatory consent checkbox on both SignupPage (email signup) and OnboardingPage (OAuth signup, step 3).
- Submit is blocked if `agreed !== true` — error shown inline.
- Checkbox links to `/privacy` and `/terms`. Styled via `.auth-consent-row`, `.auth-consent-check`, `.auth-consent-text` in `AuthPages.css`.

### Course Enrollment Limit
- `MAX_COURSES_PER_STUDENT = 9` in `server/routes/content.js`.
- If exceeded: 409 `COURSE_LIMIT_REACHED` error.
- Frontend (`TutorialQuestionsPage`): catches this and shows a modal with a mailto link to `support@yourpadi.com?subject=Add%20extra%20courses`.
- Admin bypass: `POST /api/admin/students/:id/courses` does NOT enforce the 9-course cap.
- TQ solve credits: Base = 3 solves per course per semester; Premium = 5 solves per course per semester.
- When credits are exhausted, solve button shows "🔓 Upgrade for more" (opens upgrade modal). Base users see Premium pitch; Premium users see "Credits reset each semester" message.

### Subscription Pause
- Student or admin can pause an active subscription for 1, 2, or 3 months.
- `paused_until TIMESTAMPTZ` on `subscriptions` — when set and in the future, `requireSubscription` returns 403 `SUBSCRIPTION_PAUSED` with `pausedUntil` timestamp in response body.
- On resume (early or automatic): `current_period_end` is extended by the remaining pause duration so the student doesn't lose paid time.
- **Stripe**: `pause_collection: { behavior: 'void' }` called on the Stripe subscription — next invoice is voided, no charge during pause. Cleared on resume.
- **Paystack**: Padi-level access pause only (Paystack has no native pause API). Billing continues at the provider. The AccountPage modal includes a clear note about this and links to support for manual cancellation.
- Routes: `POST /api/payments/pause` (body: `{ months: 1|2|3 }`) and `POST /api/payments/resume`.
- Admin can also pause/resume via `PATCH /api/admin/students/:id/subscription` with `action: 'pause'` or `action: 'resume'`.
- `pauseSubscription(months)` and `resumeSubscription()` in `api.js`.
- UI: AccountPage shows pause card when subscription is active. Shows resume card (with date) when paused. Modal has 1/2/3 month selector. Paystack warning included.

### Summer Semester Flag
- `summer_semester BOOLEAN DEFAULT FALSE` on `profiles`.
- Admin-toggled from the Students tab detail modal.
- Students on a catch-up/summer semester (missed S1, doing June–August) follow the same September reset as everyone else. No special calendar or cron logic.
- Shown as ☀️ badge in the admin Students table.

### Session Advancement Banner
- Dashboard shows an amber dismissable banner in August (month === 7, 0-indexed) warning about the September 1 academic session reset.
- Dismissed via localStorage key `padi_session_banner_dismissed` storing the current year (integer as string). Shows once per academic year.
- `showSessionBanner` state in DashboardPage: `currentMonth === 7 && bannerDismissedYear < currentYear`.

### Offline Library (Service Worker)
- Service worker at `client/public/sw.js` (CACHE_VERSION = 'padi-v2' — bump to invalidate all caches).
- `/api/user/library`: **stale-while-revalidate** — serves cached library immediately when offline, updates in background when online.
- All other `/api/` routes: **network-only** — AI, auth, and payments are never served stale.
- Static assets (`.js`, `.css`, fonts, images, `/assets/`): **cache-first** — Vite content-hashes filenames so stale is never a concern.
- HTML navigation: **network-first**, falls back to cached `index.html` (SPA routing).
- Registered in `main.jsx` on `window.load`.

---

## Environment Variables

### server/.env
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TAVILY_API_KEY=                            # tavily.com — web search fallback on /explain route
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM=Padi <onboarding@resend.dev>   # change to hello@yourpadi.com once domain is set up
RESEND_DEV_EMAIL=sycahq@gmail.com          # dev only — all emails go here
JWT_SECRET=
PORT=4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
R2_ACCOUNT_ID=                             # Cloudflare account ID
R2_ACCESS_KEY_ID=                          # R2 API token access key
R2_SECRET_ACCESS_KEY=                      # R2 API token secret
R2_BUCKET_NAME=padi-assets                 # R2 bucket name
R2_PUBLIC_URL=https://assets.yourpadi.com  # public URL for bucket (custom domain)
SERVER_URL=https://padi-api.up.railway.app  # public API URL — used in account deletion reactivation email link
```

### client/.env
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:4000
VITE_APP_URL=http://localhost:5173
VITE_POSTHOG_KEY=                          # posthog.com — analytics + session replay
VITE_POSTHOG_HOST=https://app.posthog.com  # or your EU endpoint
```

---

## Running the Schema

**Fresh database:** Copy the full contents of `supabase/schema.sql` into Supabase → SQL Editor and run it.

**Existing database:** Only run the **MIGRATIONS** section at the bottom of `schema.sql` — it's clearly marked and safe to re-run (all statements use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

The migrations add:
- Missing `profiles` columns: `first_name`, `last_name`, `preferred_name`, `email`
- `exam_sessions.completed_at` changed to default `NULL`
- New `user_documents` table
- New `claim_founding_member` Postgres function (atomic founding member claim)

**Migration 2026-04-30** (`supabase/migration-2026-04-30.sql`) adds:
- `profiles.deleted_at`, `profiles.deletion_token`, `profiles.deletion_token_expires_at` — NDPA soft delete
- `profiles.summer_semester BOOLEAN DEFAULT FALSE` — catch-up semester flag
- `user_preferences.session_banner_dismissed_year INTEGER` — per-user banner dismissal year
- `subscriptions.paused_until TIMESTAMPTZ`, `subscriptions.paused_at TIMESTAMPTZ` — subscription pause support

---

## Feature Flags

### `SHOW_STATS` in LandingPage.jsx
```js
const SHOW_STATS = false  // flip to true when real user numbers exist
```

### Admin access
```sql
UPDATE public.profiles SET is_admin = true WHERE id = 'your-user-id';
```

---

## Planned Features (not yet built)

### Paystack recurring billing
Set up a **Paystack Plan** for monthly recurring charges. Currently Paystack handles one-time payments only — subscribers must manually re-pay each month unless a Plan is configured. Requires active Paystack account before implementation.

### Semester bundle push (target: 500 paying users)
At 500 users, run an active push to convert monthly subscribers to the semester bundle (₦10,000 / $7 for 4 months). Benefits: better retention, upfront cash, lower churn risk. Channels: in-app banner on Dashboard, renewal reminder emails, WhatsApp broadcast to user base. Upsell logic should check `plan_type !== 'semester'` and show banner during second month (user has proven they find value).

### WhatsApp OTP (post-launch)
- Provider: **Termii** (Nigerian messaging API — termii.com)
- Use case: optional phone verification for added account security
- Not required at launch — Padi is not a fintech product and email auth is sufficient initially
- Add to onboarding as optional step once user base is established

### Flutterwave (future international payments option)
- Better African payment coverage than Paystack for some corridors
- Supports NGN + USD + GBP + EUR in a single integration
- Consider adding if Paystack's international card support proves insufficient at scale

### Exam-specific training packs (unlock at 1,000 paying customers)
- JAMB (Joint Admissions and Matriculation Board)
- WAEC (West African Examinations Council)
- NECO
- IELTS / TOEFL / SAT / GCSE

Each will have:
- Curated past question banks uploaded to knowledge_base
- Subject-specific AI prompts tuned for the exam format
- Dedicated study pack templates
- Mock exam simulations matching the actual exam structure

### Referral system
- Unique referral link per user
- Reward: 1 free month for every 3 paying referrals
- Track in `profiles` table: `referral_code`, `referred_by`, `referral_count`

### Redis-backed rate limiters
Current rate limiters use in-memory store (per process). When Railway scales to multiple instances, rate limits become per-instance instead of global. Switch to `rate-limit-redis` with a Redis connection when scaling horizontally.

---

## Running Locally

```bash
# Terminal 1 — server
cd server && npm run dev   # port 4000

# Terminal 2 — client
cd client && npm run dev   # port 5173
```

---

## Deployment

- **Frontend:** Vercel (connect GitHub repo, set env vars, auto-deploy on push)
- **Backend:** Railway (connect GitHub repo, root dir = /server, set env vars)
- **Database:** Supabase Pro ($25/mo — upgrade from free before launch)
- **Domain:** yourpadi.com on Namecheap → Cloudflare DNS → Vercel

---

## Notes for AI Assistants

- Always check import/export names match before suggesting code — mismatches were a recurring issue early in the build
- The AI service uses direct `fetch` to Anthropic API, not the `@anthropic-ai/sdk` package
- `callAI({ systemPrompt, userPrompt, taskType, useCache, maxTokens })` is the generic wrapper
- `generateAnswer({ question, course, university, userId })` — `userId` is now required to inject user document context
- Named functions (`generateAnswer`, `solveMath`, etc.) call `callAnthropic` internally; all are wrapped with `withTimeout(9000ms)`
- Supabase RLS is enabled on all tables — use `supabaseAdmin` (service role) on the server, `supabase` (anon) on the client
- `updateProfile` uses a re-fetch pattern (not `.single()`) to avoid RLS silent failures
- In dev, Resend sends all emails to `RESEND_DEV_EMAIL` — switch `NODE_ENV=production` when deploying
- `founding-count` is a **public** route (before `requireAuth`) — landing page calls it without auth
- `pendingFlags` is the correct key in admin stats response (not `unflaggedAnswers`)
- `setGracePeriod(userId)` marks subscription `past_due` + sets `grace_period_until` (+3 days). Call on payment failure webhooks.
- `cancelSubscription({ reason, reasonDetail })` in `api.js` — pass reason from CancellationModal
- `getUserProgress()` / `saveUserPreferences()` in `api.js` — used by DashboardPage
- `aiFetch` in `aiApi.js` tracks quota via `RateLimit-Remaining` header → stores in sessionStorage → dispatches `padi:ai-remaining` event
- `getStoredAIRemaining()` exported from `aiApi.js` — reads today's remaining count from sessionStorage
- AI cap message returns `code: 'DAILY_LIMIT_REACHED'` for client-side detection
- `ErrorBoundary.jsx` wraps the entire app in `App.jsx` — catches render errors, shows friendly fallback
- Privacy Policy (`/privacy`) and Terms of Service (`/terms`) are fully written in `App.jsx` as `PrivacyContent` and `TermsContent` components — NDPA 2023 compliant, references Syca Works Ltd, covers all 10 third-party processors
- `server/index.js` validates all required env vars at startup and calls `process.exit(1)` with a clear error list if any are missing — never silently fails in production
- Library items query has `.limit(100)` — prevents unbounded DB fetch as library grows
- `.gitignore` is in place at project root — `server/.env`, `client/.env`, and all `node_modules/` are excluded; verify with `git status` before first push
- Auth tokens: Supabase stores JWTs in `localStorage` by default (standard Supabase SPA pattern). Known tradeoff — acceptable for launch given no financial data on server and small XSS surface. Post-launch fix: migrate to `@supabase/ssr` with HttpOnly cookies via an Express cookie proxy
- CORS: explicit origin allowlist in `server/index.js` — `CLIENT_URL`, `yourpadi.com`, `www.yourpadi.com` only; all other origins rejected
- Webhook signatures: Paystack uses `verifyWebhookSignature` on `x-paystack-signature` — always validate before processing
- Health check: `GET /health` returns `{ status: 'ok', timestamp }` — use this as Railway's health check URL
- CSP is split across two layers: `server/index.js` helmet sets `default-src 'none'` (API returns JSON only); `client/vercel.json` sets the full browser-facing CSP — `connect-src` locks outbound connections to Supabase, PostHog, and Railway only, breaking XSS token exfiltration even if a script is injected
- `client/vercel.json` also handles SPA routing rewrites (all non-file paths → `/index.html`) and sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- When Railway backend URL is confirmed, replace `https://*.railway.app` in `client/vercel.json` `connect-src` with the exact URL (e.g. `https://padi-api.up.railway.app`)
- `CancellationModal.jsx` — import and render in account/settings page when cancel is initiated
- Semester plan: pass `plan: 'semester'` to `initializePaystackPayment()` or `createStripeCheckout()` from frontend
- `user_preferences` table is upserted by `POST /api/user/preferences` — call fire-and-forget after each topic change
- `user_documents` is user-private — never surface in shared cache or cross-user responses
- `claim_founding_member(user_id)` is a Postgres RPC function — call via `supabaseAdmin.rpc()`
- Short-answer exam grading runs in `Promise.all` — do not revert to sequential loops
- `searchWeb(query, maxResults)` in `services/webSearch.js` — 8s timeout, 1 Tavily credit per call; non-fatal (explain route catches errors and continues without web context)
- `formatWebContext(tavilyData)` — formats Tavily response into a compact context block for injection into AI prompts
- Web search toggle on AskPage: `useWebSearch` boolean state → passed as `useWebSearch: true` in `/api/ai/explain` body → response includes `webSearchUsed: boolean` and `webSearchLimitReached: boolean`
- Web search sub-limit: 20 searches/day per user tracked in `user_preferences.web_search_today` + `web_search_date`; when limit is hit, AI answer is still returned but without web context; badge shown on response card
- `extractPdfText(file)` in `aiApi.js` — uploads PDF via FormData to `/api/ai/extract-text` (multer + pdf-parse); 30s timeout for large files
- `parseFile(file, extractPdfText)` in `lib/fileParser.js` — shared utility used by StudyPacksPage, PastQuestionsPage, ExamPage; inject `extractPdfText` as parameter
- PostHog initialised in `main.jsx` via `initAnalytics()`; `identifyUser(id, props)` called on login; `resetAnalytics()` called on logout; `trackEvent(name, props)` for custom events
- `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` required in `client/.env` for analytics to fire
- Page title/nav text uses "Tutorial Questions" everywhere — the route path remains `/past-questions` for backwards compat
- `requireAuth` now fetches `profiles.deleted_at` on every authenticated request — adds one DB read per call; acceptable at current scale
- `GET /api/user/reactivate/:token` must remain BEFORE `router.use(requireAuth)` in `server/routes/user.js` — deleted users have no valid session and can't be authenticated
- `deleteAccount()` in `api.js` sends `DELETE /api/user/account` — no body; returns `{ success, message }`
- `pauseSubscription(months)` and `resumeSubscription()` in `api.js` — POST to `/api/payments/pause` and `/api/payments/resume`
- `requireSubscription` now checks `paused_until` first — if paused, returns 403 `SUBSCRIPTION_PAUSED` with `pausedUntil` in body; client should show resume option
- Admin student management in `contentApi.js`: `getAdminStudents(filters)`, `getAdminStudent(id)`, `updateAdminStudent(id, updates)`, `addStudentCourse(id, courseId)`, `removeStudentCourse(id, courseId)`, `manageStudentSubscription(id, action, options)`, `adminDeleteStudent(id)`
- `manageStudentSubscription` actions: `grant | extend | suspend | change_tier | pause | resume` — all via `PATCH /api/admin/students/:id/subscription`
- `sendAccountDeletionEmail` and `sendAccountPermanentlyDeletedEmail` in `server/services/email.js`
- `SERVER_URL` env var in Railway must be the public Railway API URL — used in deletion reactivation email link (defaults to `http://localhost:4000` if not set)
- `MAX_COURSES_PER_STUDENT = 9` in `server/routes/content.js` — 409 `COURSE_LIMIT_REACHED` error; admin bypass in `POST /api/admin/students/:id/courses`
- `summer_semester` field in profiles is admin-toggled only — shown as ☀️ badge in admin Students tab, no calendar logic attached
- SW cache version is `padi-v2` — bump to `padi-v3` (etc.) to force old cache cleanup on all clients
- Consent checkbox (`agreed` state) is mandatory on SignupPage step 1 and OnboardingPage step 3 — submit blocked if not checked

---

## Phase 2: TQ-Based Multi-Tenant Architecture (added April 2026)

### New pages
- `client/src/pages/TutorialQuestionsPage.jsx` — Main TQ browser. Route: `/tutorial-questions`. Shows user's enrolled courses in sidebar, questions for the selected course in the main area, Solve button per question, credit tracking bar. Preview mode for non-subscribers (questions text blurred after 60 chars, solve button shows "🔒 Unlock"). Solution rendered with markdown-to-HTML + KaTeX math (loaded from CDN in index.html via `renderMathInElement`).
- `client/src/pages/OnboardingPage.jsx` — 3-step flow: (1) personal details, (2) school search + dept + level select, (3) multi-select courses. Saves `school_id`, `department_id`, `level`, `plan_tier` to profiles. Enrols in selected courses via `/api/content/user/courses`.

### Updated pages
- `DashboardPage.jsx` — Added "My Courses" grid section above Quick Actions. Each course card links to `/tutorial-questions?course=<id>` and shows solve credits remaining.
- `AdminPage.jsx` — Added TQ Content tab with: school/dept/course selector dropdowns, new school/department creation forms, file upload → parse → draft preview, inline question editing, select-all + publish workflow.
- `LandingPage.jsx` — Updated features (TQ bank + AI solutions prominent), dual-tier pricing section (Base / Premium cards), founding banner shows discounted prices for both tiers.
- `PricingPage.jsx` — Full rewrite: tier toggle (Base / Premium), price changes on toggle, founding discount shown, tier comparison grid at bottom.
- `AppShell.jsx` — Added Tutorial Questions as first nav item (icon: 📖), renamed Past Questions to "Past Papers" (route unchanged at `/past-questions`).

### New API helper
- `client/src/lib/contentApi.js` — All content API calls. Key functions:
  - Public: `getSchools()`, `getSchool(slug)`, `getDepartmentCourses(schoolSlug, deptSlug)`, `searchCourses(q)`
  - Auth: `getCourseQuestions(courseId)`, `solveQuestion(questionId, context)`, `flagSolution(solutionId, reason)`, `getSolveCredits()`, `getUserCourses()`, `addUserCourse(courseId)`, `removeUserCourse(courseId)`
  - Admin: `uploadTQFile({ courseId, schoolId, file })` (60 s timeout), `patchQuestion(questionId, updates)`, `publishQuestions(questionIds)`, `getAdminSchools()`, `createSchool(data)`, `createDepartment(schoolId, data)`, `getCourseDrafts(courseId)`

### KaTeX integration
- CDN scripts in `client/index.html` (katex 0.16.9 + auto-render)
- `vercel.json` CSP updated: added `https://cdn.jsdelivr.net` to `script-src`, `style-src`, `font-src`
- `renderMath(el)` helper in TutorialQuestionsPage calls `window.renderMathInElement` after solution renders
- Delimiters: `$$...$$` for display math, `$...$` for inline math

### Solve credit flow
1. User clicks Solve on a question
2. Client POSTs to `/api/content/questions/:id/solve` (with optional `context` string)
3. Server checks for cached solution in `solutions` table — if found and not flagged, deducts credit and returns (fast path ~50ms)
4. If not cached: generates AI solution → caches it → deducts credit atomically via `deduct_solve_credit` RPC → returns
5. Response: `{ solution: { id, solution_text, cached }, creditsRemaining }`
6. Client stores solution in local state (no re-fetch needed), shows in-card below the question

### Admin TQ upload pipeline
1. Admin selects school → department → course from dropdowns (loaded from `/api/admin/schools`)
2. Uploads PDF/DOCX/TXT file → server extracts text → AI parses into structured questions
3. Draft questions saved to DB (`status: 'draft'`), returned to client for preview
4. Admin can edit individual questions inline (PATCH `/api/admin/content/questions/:id`)
5. Admin selects questions to publish, clicks Publish → POST `/api/admin/content/publish` → questions go live

### Notes for AI assistants (Phase 2)
- `TutorialQuestionsPage` imports `subscription` from `useAuth()` — make sure `AuthContext` exposes `subscription`
- `getUserCourses()` returns `{ courses: [{ course_id, courses: { course_code, course_title, ... } }] }` — the nested structure is a Supabase join alias
- `getSolveCredits()` returns `{ credits: [{ course_id, credits_remaining, credits_total, semester_label }] }`
- The solve button has four states: `✨ Solve` (unsolved), `▼ Show` / `▲ Hide` (already solved), `Solving…` (in progress), credits exhausted shows `🔓 Upgrade for more` (opens upgrade modal)
- Context input (optional) shows between question header and solution — lets student guide the AI approach
- `markdownToHtml()` is a minimal inline renderer in TutorialQuestionsPage — intentionally avoids adding a markdown library dependency
- Admin course selector requires departments to have courses loaded — the `schools` endpoint must return `departments(courses(*))` nested data
- `initializePaystackPayment` and `createStripeCheckout` in `api.js` now accept `{ tier }` param — backend must read this and set the correct amount/plan
- `PricingPage` reads `foundingOpen` from the public `/api/payments/founding-count` endpoint (same as LandingPage)
- Admin Students tab is in `AdminPage.jsx` — full CRUD: view all students (filterable by school/dept/level, search by name/email), edit profile, manage courses, manage subscription (grant/extend/suspend/change_tier/pause/resume), soft-delete

---

## Pre-Launch Checklist (as of April 2026)

Tasks to complete before going live. Check these off in sequence — each one has a hard dependency on the environment being stable.

1. **Run migration-2026-04-30.sql** — paste `supabase/migration-2026-04-30.sql` into Supabase → SQL Editor. Adds soft-delete columns, summer_semester flag, session banner year, and subscription pause columns. Safe to re-run (all `IF NOT EXISTS`).
2. **Set `SERVER_URL` in Railway** — must be the public backend URL (e.g. `https://padi-api.up.railway.app`). Used in account deletion reactivation email links.
3. **Paystack account setup** — submit CAC docs, get approved, configure webhook URL (`/api/payments/webhook/paystack`), set up a monthly recurring Plan for auto-renewal (currently only one-time charges are wired). Target: first Sunday of May 2026.
2. **First TQ batch upload** — Computing dept: upload PDFs via admin panel → review drafts → publish. Do this on a deployed staging environment, not localhost.
3. **E2E test run** — full happy path: signup → onboarding (school/dept/course) → browse TQs → solve a question → admin upload → publish; test both Base and Premium paths separately.
4. **Supabase Pro upgrade** — free tier pauses on inactivity and has a 500MB DB limit. Upgrade to Pro ($25/mo) before any real users hit it.
5. **Railway paid tier** — Starter ($5/mo) keeps the API always-on; free tier sleeps.
6. **Anthropic credits** — top up to ~$30 before launch to avoid cold interruptions during testing.
7. **Resend domain verification** — verify yourpadi.com in Resend dashboard, then set `RESEND_FROM=Padi <hello@yourpadi.com>` in Railway env vars.
8. **Railway backend URL** — once confirmed (e.g. `padi-api.up.railway.app`), replace `*.railway.app` wildcard in `client/vercel.json` `connect-src` with the exact URL.
9. **PostHog check** — log in to PostHog, confirm `identify`, page view, and at least one custom event (`solve_question`, `study_pack_generated`) are appearing in Live Events.
10. **Railway Cron Job** — create a second Railway service pointing at `server/`, command `npm run advance-session`, cron `0 6 1 9 *` (6am WAT, September 1 each year).

---

## AI Cost Management Strategy

### Core principles
- **Cache first** — `ai_cache` table stores every cacheable response keyed by `hash(taskType + systemPrompt + userPrompt)`. Once the first student solves a TQ, every subsequent student gets the same solution instantly at near-zero cost. Cache value compounds as the user base grows.
- **Never cache user-document context** — when a student's personal uploads are injected into a prompt, the response is deliberately not cached (`useCache: false`). This prevents one student's private content leaking into another student's cached answer.
- **Model selection by task complexity** — Haiku 4.5 for all routine calls (Ask Padi, study packs, TQ solving, summarise, refine); Sonnet 4.6 only for tasks that need it (maths, exam generation, past-question analysis). Sonnet costs ~6× more per call — don't promote it without measuring the quality delta first.
- **Two-layer rate limiting** — `aiLimiter` (5 req/min) absorbs burst abuse; `aiDailyLimiter` (40 req/24h) caps per-user spend. If legitimate users are hitting the daily cap, raise it before cutting features. If costs spike, lower the cap before changing model selection.

### Projected cost per user per month (mature cache, ~40% hit rate)

| Tier | Scenario | AI cost | Revenue | Margin |
|---|---|---|---|---|
| Base (₦3,000 / ~$2) | Low — mostly cached TQ solves | $0.02 | $2 | $1.98 |
| Base | Average | $0.08 | $2 | $1.92 |
| Base | High — early user, 16 courses, all fresh | $0.35 | $2 | $1.65 |
| Premium (₦7,000 / ~$4.50) | Low — light Ask Padi, high cache | $0.10 | $4.50 | $4.40 |
| Premium | Average — moderate Ask Padi use | $0.50 | $4.50 | $4.00 |
| Premium | High — power user hitting daily limit | $1.80 | $4.50 | $2.70 |
| Premium founding (₦4,500 / ~$2.90) | Average | $0.50 | $2.90 | $2.40 |
| Premium founding | High | $1.80 | $2.90 | $1.10 |

Founding Premium at high usage leaves ~$1.10 margin — the daily limiter (40 calls/day) is the safety valve. At regular Premium (₦7,000), even the worst-case power user leaves a healthy margin.

### Cost levers in priority order
1. Cache hit rate — grows organically; nothing to build, just get more users
2. Daily limit — lower from 40 → 30 if costs exceed ₦800/user ceiling; raise to 50 if retention data shows users are frustrated
3. Model selection — demote any Sonnet route to Haiku if quality testing shows no meaningful delta
4. Knowledge base semantic search — inject pre-computed KB summaries instead of re-calling AI for well-covered topics (post-launch optimisation)
5. Redis rate limiters — needed when Railway scales beyond one instance; current in-memory limiters are per-process

### "Priority AI" (marketing claim)
Currently there is no queue prioritisation between Base and Premium users — both hit the same Anthropic API endpoint. This is acceptable at launch (Haiku responds in ~1s; there's no perceptible queue). Post-launch, if this becomes meaningful, route Premium users to a dedicated API key with higher rate limits, or simply document it as "best effort priority" in the terms.
