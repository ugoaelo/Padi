/**
 * semester-s2.js
 * ──────────────
 * Semester 2 transition job for Padi.
 * Runs on March 1 each year.
 *
 * What it does:
 *  1. Marks all current S1 calendars as no longer current
 *  2. Creates / updates school_calendar entries for S2 (is_current = true)
 *  3. Clears user_courses so students re-enrol for their new semester courses
 *
 * NOTE: Does NOT advance student levels — that only happens in September (session-advancement.js).
 * NOTE: Does NOT clear study packs — those are wiped annually at session start, not mid-year.
 *
 * Run manually:  node server/scripts/semester-s2.js
 * Scheduled:     Runs automatically via Cowork scheduled task on March 1st
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const now         = new Date()
  const currentYear = now.getFullYear()

  // Academic year: if we're in March, the session started September of the prior year
  // e.g. March 2026 → session 2025/2026, S2 label = "2025/2026-S2"
  const sessionStartYear = currentYear - 1
  const academicYear     = `${sessionStartYear}/${currentYear}`
  const semLabel         = `${academicYear}-S2`

  console.log(`\n── Padi Semester 2 Transition ────────────────`)
  console.log(`Date:         ${now.toISOString()}`)
  console.log(`Academic year: ${academicYear}`)
  console.log(`Semester:      ${semLabel}`)
  console.log(`──────────────────────────────────────────────\n`)

  // ── Idempotency guard ─────────────────────────────────────────────
  const { data: alreadyRun } = await supabase
    .from('school_calendars')
    .select('id')
    .eq('academic_year', academicYear)
    .eq('semester', 2)
    .eq('is_current', true)
    .limit(1)

  if (alreadyRun && alreadyRun.length > 0) {
    console.log(`✓ S2 for ${academicYear} already activated — exiting without changes.\n`)
    return
  }

  // ── 1. Get all active subscriber user IDs ─────────────────────────
  const { data: activeSubs, error: subErr } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'active')

  if (subErr) throw new Error(`Failed to fetch active subscriptions: ${subErr.message}`)

  const activeUserIds = (activeSubs || []).map(s => s.user_id)
  console.log(`Active subscribers: ${activeUserIds.length}`)

  if (activeUserIds.length > 0) {
    // ── 2. Clear user_courses — students re-enrol for S2 ─────────────
    const { error: clearErr } = await supabase
      .from('user_courses')
      .delete()
      .in('user_id', activeUserIds)

    if (clearErr) {
      console.warn(`  ⚠ Failed to clear user courses: ${clearErr.message}`)
    } else {
      console.log(`Course selections cleared — students will re-enrol for S2`)
    }
  }

  // ── 3. Update school calendars ─────────────────────────────────────
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name')
    .eq('is_active', true)

  if (schoolErr) throw new Error(`Failed to fetch schools: ${schoolErr.message}`)

  console.log(`\nUpdating calendars for ${schools?.length || 0} school(s)...`)

  for (const school of (schools || [])) {
    // Mark all existing calendars for this school as not current
    await supabase
      .from('school_calendars')
      .update({ is_current: false })
      .eq('school_id', school.id)

    // Insert (or update) S2 as current
    // Default S2: March 1 → June 30. Admin can override via the admin calendar UI.
    const { error: calErr } = await supabase
      .from('school_calendars')
      .upsert({
        school_id:      school.id,
        academic_year:  academicYear,
        semester:       2,
        semester_label: semLabel,
        start_date:     `${currentYear}-03-01`,
        end_date:       `${currentYear}-06-30`,
        is_current:     true,
      }, { onConflict: 'school_id,semester_label' })

    if (calErr) {
      console.warn(`  ⚠ Calendar error for ${school.name}: ${calErr.message}`)
    } else {
      console.log(`  ✓ ${school.name} → ${semLabel}`)
    }
  }

  console.log(`\n── S2 transition complete ────────────────────\n`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n✗ Semester S2 transition failed:', err.message)
    process.exit(1)
  })
