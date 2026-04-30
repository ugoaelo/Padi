# Padi — Your AI Study Partner
> Complete codebase · React + Node.js · Anthropic API · Supabase · Paystack + Stripe

---

## Quick Start

### Step 1 — Install dependencies

```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

### Step 2 — Set up environment variables

```bash
# Frontend
cd client
cp .env.example .env
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

# Backend
cd ../server
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
#          PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, JWT_SECRET, CLIENT_URL
```

### Step 3 — Set up Supabase database

1. Go to supabase.com → your Padi project
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Open `supabase/schema.sql` from this project
5. Copy all contents → paste into SQL editor → click **Run**
6. You should see success messages for each table

### Step 4 — Make yourself admin

After running the schema, run this in the SQL editor
(replace with your actual user ID from Supabase Auth → Users):

```sql
UPDATE public.profiles SET is_admin = true WHERE id = 'your-user-id-here';
```

### Step 5 — Run the project

```bash
# Terminal 1 — Backend
cd server
npm run dev
# Runs on http://localhost:4000

# Terminal 2 — Frontend
cd client
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 — Padi is running.

---

## Environment Variables Reference

### client/.env

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `VITE_API_URL` | `http://localhost:4000` (dev) or your Railway URL (prod) |

### server/.env

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `PAYSTACK_SECRET_KEY` | paystack.com → Settings → API |
| `PAYSTACK_WEBHOOK_SECRET` | paystack.com → Settings → Webhooks |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks |
| `JWT_SECRET` | Generate a random 32+ char string |
| `CLIENT_URL` | `http://localhost:5173` (dev) or `https://yourpadi.com` (prod) |
| `PORT` | `4000` |

---

## Project Structure

```
padi/
├── client/                          # React + Vite frontend
│   ├── public/
│   │   ├── manifest.json            # PWA manifest
│   │   └── sw.js                    # Service worker
│   └── src/
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.jsx     # Sidebar navigation layout
│       │   │   └── AppShell.css
│       │   └── ui/
│       │       ├── AIResponseCard   # AI response with save/share/flag/refine
│       │       ├── StudyPackCard    # Full study pack viewer (notes/flashcards/quiz)
│       │       ├── PWAInstallPrompt # Add to home screen prompt
│       │       └── SupportWidget    # Floating support button
│       ├── context/
│       │   └── AuthContext.jsx      # Auth state, all auth methods
│       ├── lib/
│       │   ├── supabase.js          # Supabase client
│       │   ├── api.js               # Payment API calls
│       │   └── aiApi.js             # All AI + exam + review API calls
│       ├── pages/
│       │   ├── LandingPage          # Marketing page + waitlist
│       │   ├── LoginPage            # Email + Google OAuth login
│       │   ├── SignupPage           # 2-step signup with profile
│       │   ├── OnboardingPage       # OAuth user profile completion
│       │   ├── DashboardPage        # Home screen
│       │   ├── AskPage              # Topic learning + math solver
│       │   ├── StudyPacksPage       # Study pack generator
│       │   ├── ExamPage             # Exam simulation + results
│       │   ├── PastQuestionsPage    # Past paper analysis + predictions
│       │   ├── LibraryPage          # Offline library
│       │   ├── ReviewPage           # Spaced repetition (SM-2)
│       │   ├── AdminPage            # Super admin panel
│       │   ├── PricingPage          # Paystack + Stripe checkout
│       │   └── PaymentSuccessPage   # Post-payment confirmation
│       └── styles/
│           └── globals.css          # Design tokens + shared styles
│
├── server/                          # Node.js + Express backend
│   ├── db/
│   │   └── supabase.js              # Supabase admin client (service role)
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification + subscription check
│   │   └── rateLimiter.js           # 5-tier rate limiting
│   ├── routes/
│   │   ├── ai.js                    # AI endpoints (explain/math/pack/summarise/flag/library)
│   │   ├── exam.js                  # Exam generate/submit/history/past questions
│   │   ├── payments.js              # Paystack + Stripe + webhooks + refunds
│   │   ├── review.js                # Spaced repetition endpoints
│   │   ├── waitlist.js              # Waitlist signup
│   │   └── admin.js                 # Super admin endpoints
│   └── services/
│       ├── ai.js                    # Anthropic API (explain/math/pack/summarise/refine)
│       ├── exam.js                  # Exam generation + grading + past question analysis
│       ├── spaced.js                # SM-2 algorithm + recall questions
│       ├── paystack.js              # Paystack API wrapper
│       ├── stripe.js                # Stripe API wrapper
│       └── subscription.js          # Founding member logic + subscription management
│
└── supabase/
    └── schema.sql                   # Complete database schema — run this first
```

---

## Key Feature Flags

### Activate stats section on landing page
In `client/src/pages/LandingPage.jsx`:
```js
const SHOW_STATS = false  // ← change to true when you have users
```

### Update founding member counter
In `client/src/components/Hero.jsx`:
```js
const SPOTS_USED = 0  // ← update with real API call when backend is ready
```
The `/api/payments/founding-count` endpoint returns real-time count.

### Make yourself admin
```sql
UPDATE public.profiles SET is_admin = true WHERE id = 'your-user-id';
```

---

## Deployment

### Frontend → Vercel
1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy — auto-deploys on every push

### Backend → Railway
1. Push to GitHub
2. Create new Railway project → connect repo
3. Set root directory to `/server`
4. Add environment variables
5. Deploy

### Domain → yourpadi.com
1. Buy on Namecheap (code NEWCOM679 — $6.79/yr)
2. Add to Cloudflare for DNS + CDN
3. Point to Vercel in Cloudflare DNS settings

### Supabase → Upgrade to Pro
Once you have paying students, upgrade Supabase from free to Pro ($25/mo).
This removes project pausing and enables daily backups.

---

## Security Notes

- Never commit `.env` files — they are in `.gitignore`
- The `SUPABASE_SERVICE_ROLE_KEY` must only ever live in `server/.env`
- Paystack and Stripe webhook signatures are verified on every event
- All database tables have Row Level Security (RLS) enabled
- Rate limiting is active on all AI endpoints to control costs

---

## Support

- Email: support@yourpadi.com
- Built by Syca · yourpadi.com
