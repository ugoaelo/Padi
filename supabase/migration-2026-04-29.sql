-- ─────────────────────────────────────────────────────────────────
-- Padi Migration — 2026-04-29
-- Run in Supabase → SQL Editor on any existing database.
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────

-- ── EXAM SESSIONS: resume support ────────────────────────────────
-- Tracks which question a student was on + seconds left when they left.
-- Both default to NULL / 0 on existing rows — no data loss.
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS question_index  INTEGER DEFAULT 0;

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS time_remaining  INTEGER;  -- seconds remaining; NULL = not tracked

-- ── USER PREFERENCES: web search daily counter ───────────────────
-- Enforces the 20 Tavily web-search calls per user per day sub-limit.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS web_search_today INTEGER DEFAULT 0;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS web_search_date  DATE DEFAULT CURRENT_DATE;

-- ── KNOWLEDGE BASE: level tagging ────────────────────────────────
-- Admin can now tag KB documents to a specific student level (100–600).
-- NULL = document applies to all levels.
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS level TEXT;
-- e.g. '100' | '200' | '300' | '400' | '500' | '600' | NULL

CREATE INDEX IF NOT EXISTS idx_knowledge_base_level
  ON public.knowledge_base(level);
