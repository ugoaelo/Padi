-- ─────────────────────────────────────────────────────────────────
-- Padi Migration — 2026-04-30
-- Run in Supabase → SQL Editor on any existing database.
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────

-- ── PROFILES: soft delete (NDPA right to erasure) ────────────────
-- deleted_at: set when user requests account deletion.
-- Accounts are permanently wiped after 30 days (cron or manual).
-- deletion_token: signed token emailed for one-click reactivation.
-- deletion_token_expires_at: 30-day window to reactivate.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_token TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_token_expires_at TIMESTAMPTZ;

-- Index: fast lookup for auth middleware check + periodic wipe cron
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── PROFILES: summer semester flag ───────────────────────────────
-- Admin toggles this to mark students on a non-standard semester
-- (e.g. missed S1, doing a catch-up June–August semester).
-- No separate calendar logic required — they follow the same
-- September reset as everyone else.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS summer_semester BOOLEAN DEFAULT FALSE;

-- ── USER PREFERENCES: session banner dismissal ───────────────────
-- Stores the year a user last dismissed the "new session soon" banner
-- so we only show it once per academic year (August only).
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS session_banner_dismissed_year INTEGER;

-- ── SUBSCRIPTIONS: pause support ─────────────────────────────────
-- paused_until: when set, blocks API access (requireSubscription returns
-- 403 SUBSCRIPTION_PAUSED). current_period_end is extended by the pause
-- duration on resume so the student doesn't lose paid time.
-- paused_at: timestamp when the pause was requested (for audit trail).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- Index for fast pause-status lookups in middleware
CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_until
  ON public.subscriptions(paused_until)
  WHERE paused_until IS NOT NULL;
