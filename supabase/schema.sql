-- ─────────────────────────────────────────────────────────────────
-- Padi Database Schema
-- Run this in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- ── PROFILES ─────────────────────────────────────────────────────
-- Extends Supabase auth.users with Padi-specific data
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  dob              DATE,
  university       TEXT,
  course           TEXT,
  whatsapp         TEXT,
  founding_member  BOOLEAN DEFAULT FALSE,
  locked_price     INTEGER DEFAULT NULL, -- in Naira (3000 for founding members)
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when a new user signs up via OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── RLS: PROFILES ─────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── WAITLIST ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  dob         DATE,
  email       TEXT NOT NULL UNIQUE,
  university  TEXT,
  course      TEXT,
  whatsapp    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can join the waitlist, nobody can read it (admin only via service role)
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT
  WITH CHECK (TRUE);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'inactive',
  -- status: inactive | active | cancelled | past_due | refunded
  plan                  TEXT NOT NULL DEFAULT 'monthly',
  amount                INTEGER NOT NULL DEFAULT 3000, -- in Naira
  paystack_customer_id  TEXT,
  paystack_sub_code     TEXT,
  stripe_customer_id    TEXT,
  stripe_sub_id         TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  refund_eligible_until TIMESTAMPTZ, -- 48hrs after first payment
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can write subscription data (backend only)
-- No user INSERT/UPDATE policy — backend handles this via service key

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── INDEXES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_email        ON public.waitlist(email);

-- ── STUDY PACKS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  topic       TEXT,
  content     JSONB NOT NULL DEFAULT '{}',
  source_type TEXT DEFAULT 'topic', -- 'topic' | 'document' | 'paste'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.study_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own study packs"
  ON public.study_packs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_study_packs_user_id ON public.study_packs(user_id);

-- ── LIBRARY ITEMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.library_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL, -- 'answer' | 'study_pack' | 'exam' | 'summary'
  title       TEXT NOT NULL,
  content     JSONB NOT NULL DEFAULT '{}',
  saved_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own library"
  ON public.library_items FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_library_items_user_id ON public.library_items(user_id);

-- ── EXAM SESSIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id      UUID REFERENCES public.study_packs(id) ON DELETE SET NULL,
  topic        TEXT,
  questions    JSONB NOT NULL DEFAULT '[]',
  answers      JSONB NOT NULL DEFAULT '[]',
  score        INTEGER DEFAULT 0,
  total        INTEGER DEFAULT 0,
  time_taken   INTEGER, -- seconds
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own exams"
  ON public.exam_sessions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON public.exam_sessions(user_id);

-- ── FLAGGED ANSWERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flagged_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question    TEXT,
  answer      TEXT,
  reason      TEXT,
  reviewed    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.flagged_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert flags"
  ON public.flagged_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own flags"
  ON public.flagged_answers FOR SELECT USING (auth.uid() = user_id);

-- ── AI CACHE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash  TEXT UNIQUE NOT NULL,
  response     TEXT NOT NULL,
  model_used   TEXT,
  token_count  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS on ai_cache — service role only, no user access
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_cache(prompt_hash);

-- ── STUDY SESSIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic       TEXT,
  input_type  TEXT DEFAULT 'question', -- 'question' | 'math' | 'document' | 'topic'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions"
  ON public.study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON public.study_sessions(user_id);

-- ── REVIEW ITEMS (Spaced Repetition) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id       UUID REFERENCES public.study_packs(id) ON DELETE SET NULL,
  item_type     TEXT NOT NULL DEFAULT 'flashcard', -- 'flashcard' | 'concept'
  front         TEXT NOT NULL,
  back          TEXT NOT NULL,
  repetitions   INTEGER DEFAULT 0,
  ease_factor   DECIMAL DEFAULT 2.5,
  interval      INTEGER DEFAULT 1, -- days
  next_review   DATE DEFAULT CURRENT_DATE,
  last_reviewed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own review items"
  ON public.review_items FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_review_items_user_review
  ON public.review_items(user_id, next_review);

-- ── KNOWLEDGE BASE (Super Admin uploads) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT UNIQUE NOT NULL,
  subject    TEXT,
  type       TEXT DEFAULT 'document',
  content    TEXT,
  summary    TEXT,
  added_by   UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No user RLS — service role only, admin managed
CREATE INDEX IF NOT EXISTS idx_knowledge_base_subject ON public.knowledge_base(subject);

-- ── ADD ADMIN FLAG TO PROFILES ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- To make yourself admin, run this in SQL editor (replace with your user ID):
-- UPDATE public.profiles SET is_admin = true WHERE id = 'your-user-id-here';

-- ─────────────────────────────────────────────────────────────────
-- MIGRATIONS — Run these on existing databases (safe to re-run)
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ─────────────────────────────────────────────────────────────────

-- ── Subscription: grace period + semester plan support ────────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'monthly';
-- plan_type: 'monthly' | 'semester' (4-month bundle)

-- ── CANCELLATIONS — churn reason tracking ────────────────────────
CREATE TABLE IF NOT EXISTS public.cancellations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           TEXT NOT NULL,          -- one of the preset reasons
  reason_detail    TEXT,                   -- optional free text
  months_subscribed INTEGER DEFAULT 1,     -- how long they were subscribed
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;
-- Admin can read all; users cannot read their own (no need to expose)
CREATE POLICY "Service role only — cancellations"
  ON public.cancellations FOR ALL USING (false);

-- ── USER PREFERENCES — resume topic + AI quota tracking ──────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_topic     TEXT,
  last_subject   TEXT,
  last_section   TEXT,   -- 'ask' | 'study-packs' | 'exam' | 'past-questions'
  ai_calls_today INTEGER DEFAULT 0,
  ai_calls_date  DATE    DEFAULT CURRENT_DATE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- ── Missing profile columns (required for name display + personalisation) ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email          TEXT;

-- ── Fix exam_sessions: completed_at should be NULL until submitted ──
-- NOTE: If running on a fresh DB, replace DEFAULT NOW() above with DEFAULT NULL.
-- On an existing DB, this sets a sensible default going forward:
ALTER TABLE public.exam_sessions ALTER COLUMN completed_at SET DEFAULT NULL;

-- ── USER DOCUMENTS — stores summaries of user-uploaded material ───
-- Used to personalise AI answers with the student's own course content
CREATE TABLE IF NOT EXISTS public.user_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  subject     TEXT,
  summary     TEXT NOT NULL,
  source_type TEXT DEFAULT 'upload', -- 'upload' | 'study_pack'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents"
  ON public.user_documents FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id
  ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_subject
  ON public.user_documents(user_id, subject);

-- ── ATOMIC FOUNDING MEMBER CLAIM ──────────────────────────────────
-- Prevents race conditions when the 100th founding spot is claimed concurrently.
-- Single UPDATE statement is atomic — no TOCTOU gap.
CREATE OR REPLACE FUNCTION public.claim_founding_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH eligible AS (
    SELECT 1
    WHERE (SELECT COUNT(*) FROM public.profiles WHERE founding_member = true) < 100
  ),
  updated AS (
    UPDATE public.profiles
    SET founding_member = true, locked_price = 3000
    WHERE id = p_user_id
      AND NOT COALESCE(founding_member, false)
      AND EXISTS (SELECT 1 FROM eligible)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- MULTI-TENANT CONTENT ARCHITECTURE
-- Phase 1 — Schools, Departments, Courses, TQs, Solve Credits
-- Safe to run on existing databases (all use IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────

-- ── SCHOOLS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,                  -- e.g. "Lead City University"
  slug         TEXT NOT NULL UNIQUE,           -- e.g. "lead-city"
  short_name   TEXT,                           -- e.g. "LCU"
  country      TEXT NOT NULL DEFAULT 'Nigeria',
  state        TEXT,                           -- e.g. "Oyo"
  logo_url     TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_slug ON public.schools(slug);

-- ── DEPARTMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,                  -- e.g. "Computing & Information Sciences"
  slug         TEXT NOT NULL,                  -- e.g. "computing"
  faculty      TEXT,                           -- e.g. "Faculty of Engineering & Technology"
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_departments_school_id ON public.departments(school_id);

-- ── COURSES ───────────────────────────────────────────────────────
-- One row per course per school. Course codes are school-scoped.
CREATE TABLE IF NOT EXISTS public.courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  course_code   TEXT NOT NULL,                 -- e.g. "SEN 201"
  course_title  TEXT NOT NULL,                 -- e.g. "Intro to Software Engineering"
  level         INTEGER NOT NULL,              -- 100 | 200 | 300 | 400 | 500
  semester      INTEGER NOT NULL,              -- 1 | 2
  credit_units  INTEGER DEFAULT 2,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, course_code)               -- course codes unique per school
);

CREATE INDEX IF NOT EXISTS idx_courses_school_id     ON public.courses(school_id);
CREATE INDEX IF NOT EXISTS idx_courses_department_id ON public.courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_level_sem     ON public.courses(school_id, level, semester);

-- ── TUTORIAL QUESTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutorial_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_text   TEXT,                        -- parsed text of the question
  question_image_url TEXT,                     -- R2 URL if original was a photo/scan
  raw_content     TEXT,                        -- original unparsed content (kept for re-parsing)
  topic           TEXT,                        -- e.g. "Software Development Life Cycle"
  question_number INTEGER,                     -- order within the TQ set
  year            INTEGER,                     -- academic year if known, e.g. 2023
  status          TEXT NOT NULL DEFAULT 'draft',
  -- status: 'draft' | 'published' | 'archived'
  flagged         BOOLEAN DEFAULT FALSE,
  flag_reason     TEXT,
  uploaded_by     UUID REFERENCES auth.users(id),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tutorial_questions ENABLE ROW LEVEL SECURITY;

-- Students can only see published questions for their school
CREATE POLICY "Students see published questions for their school"
  ON public.tutorial_questions FOR SELECT
  USING (
    status = 'published'
    AND school_id IN (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_tq_school_id  ON public.tutorial_questions(school_id);
CREATE INDEX IF NOT EXISTS idx_tq_course_id  ON public.tutorial_questions(course_id);
CREATE INDEX IF NOT EXISTS idx_tq_status     ON public.tutorial_questions(status);

CREATE TRIGGER tq_updated_at
  BEFORE UPDATE ON public.tutorial_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── SOLUTIONS ─────────────────────────────────────────────────────
-- AI-generated solutions, cached per question.
-- One canonical solution per question (updated if flagged incorrect).
CREATE TABLE IF NOT EXISTS public.solutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES public.tutorial_questions(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  solution_text   TEXT NOT NULL,
  model_used      TEXT DEFAULT 'claude-haiku-4-5-20251001',
  token_count     INTEGER,
  flagged         BOOLEAN DEFAULT FALSE,
  flag_count      INTEGER DEFAULT 0,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id)                          -- one solution per question
);

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

-- Only subscribers can read solutions
CREATE POLICY "Subscribers can read solutions for their school"
  ON public.solutions FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_solutions_question_id ON public.solutions(question_id);
CREATE INDEX IF NOT EXISTS idx_solutions_school_id   ON public.solutions(school_id);

CREATE TRIGGER solutions_updated_at
  BEFORE UPDATE ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── SOLVE CREDITS ─────────────────────────────────────────────────
-- Tracks how many "Solve" clicks a user has used per course per semester.
-- Base: 3 credits per course per semester.
-- Premium: 5 credits per course per semester.
-- Credits deducted ONLY after confirmed successful solution delivery.
CREATE TABLE IF NOT EXISTS public.solve_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  semester_label  TEXT NOT NULL,               -- e.g. "2024-2025-S1" (school year + semester)
  credits_total   INTEGER NOT NULL DEFAULT 3,  -- set at grant time based on plan
  credits_used    INTEGER NOT NULL DEFAULT 0,
  last_reset      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id, semester_label)
);

ALTER TABLE public.solve_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own solve credits"
  ON public.solve_credits FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_solve_credits_user_id   ON public.solve_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_solve_credits_course_sem ON public.solve_credits(user_id, course_id, semester_label);

-- Atomic credit deduction — returns FALSE if no credits remain
CREATE OR REPLACE FUNCTION public.deduct_solve_credit(
  p_user_id      UUID,
  p_course_id    UUID,
  p_semester_label TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.solve_credits
    SET credits_used = credits_used + 1,
        updated_at   = NOW()
    WHERE user_id       = p_user_id
      AND course_id     = p_course_id
      AND semester_label = p_semester_label
      AND credits_used  < credits_total
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── USER COURSES (selected courses junction) ───────────────────────
-- Stores which courses each student has selected for their dashboard.
CREATE TABLE IF NOT EXISTS public.user_courses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own course selections"
  ON public.user_courses FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_courses_user_id  ON public.user_courses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_courses_school_id ON public.user_courses(school_id);

-- ── SCHOOL CALENDARS ──────────────────────────────────────────────
-- Admin-managed semester dates per school.
-- Used to determine active semester and trigger credit resets.
CREATE TABLE IF NOT EXISTS public.school_calendars (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year  TEXT NOT NULL,                -- e.g. "2024/2025"
  semester       INTEGER NOT NULL,             -- 1 | 2
  semester_label TEXT NOT NULL,                -- e.g. "2024-2025-S1" (matches solve_credits)
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  is_current     BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, semester_label)
);

CREATE INDEX IF NOT EXISTS idx_school_calendars_school ON public.school_calendars(school_id);
CREATE INDEX IF NOT EXISTS idx_school_calendars_current ON public.school_calendars(school_id, is_current);

-- Only one current semester per school at a time
CREATE OR REPLACE FUNCTION public.enforce_single_current_semester()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE public.school_calendars
    SET is_current = FALSE
    WHERE school_id = NEW.school_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_current_semester
  AFTER INSERT OR UPDATE ON public.school_calendars
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_current_semester();

-- ── PROFILE ADDITIONS FOR MULTI-TENANT ───────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id     UUID REFERENCES public.schools(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level         INTEGER; -- 100 | 200 | 300 | 400 | 500
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier     TEXT DEFAULT 'base';
-- plan_tier: 'base' | 'premium'

-- ── SUBSCRIPTION TIER ADDITION ────────────────────────────────────
-- plan_type already exists ('monthly' | 'semester')
-- tier is now tracked separately on profiles.plan_tier
-- Update founding member claim to also set plan_tier
CREATE OR REPLACE FUNCTION public.claim_founding_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH eligible AS (
    SELECT 1
    WHERE (SELECT COUNT(*) FROM public.profiles WHERE founding_member = true) < 100
  ),
  updated AS (
    UPDATE public.profiles
    SET founding_member = true,
        locked_price    = 3000
    WHERE id = p_user_id
      AND NOT COALESCE(founding_member, false)
      AND EXISTS (SELECT 1 FROM eligible)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated FROM updated;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── SEED: LEAD CITY UNIVERSITY ────────────────────────────────────
-- First school. Run once. Safe to re-run (INSERT ... ON CONFLICT DO NOTHING).
INSERT INTO public.schools (id, name, slug, short_name, state)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Lead City University',
  'lead-city',
  'LCU',
  'Oyo'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.departments (id, school_id, name, slug, faculty)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Computing & Information Sciences',
  'computing',
  'Faculty of Engineering & Technology'
) ON CONFLICT (school_id, slug) DO NOTHING;

-- ── EXAM SESSIONS: add resume support columns ────────────────────
-- question_index: the last question the student was on (0-based)
-- time_remaining: seconds left on the clock when they left
-- NULL on both means not started or already completed
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS question_index  INTEGER DEFAULT 0;
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS time_remaining  INTEGER;  -- seconds remaining

-- ── USER PREFERENCES: add web_search_today counter ───────────────
-- Tracks daily Tavily usage to enforce the 20/day sub-limit per user
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS web_search_today INTEGER DEFAULT 0;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS web_search_date  DATE DEFAULT CURRENT_DATE;

-- ── KNOWLEDGE BASE: add level column ─────────────────────────────
-- Allows admin to tag KB docs to a specific level (100–600) so context
-- injection is only applied when the user's level matches.
-- NULL = applies to all levels.
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS level TEXT;
-- e.g. '100', '200', '300', '400', '500', '600' or NULL (all levels)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_level ON public.knowledge_base(level);
