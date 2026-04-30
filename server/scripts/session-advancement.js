/**
 * session-advancement.js
 * ─────────────────────
 * Annual September session advancement job for Padi.
 *
 * What it does:
 *  1. Advances every active subscriber's level by 100 (cap: 600)
 *  2. Marks all school calendars as no longer current
 *  3. Creates new school_calendar entries for the new session's first semester
 *  4. Clears user_courses so students re-enrol for their new session
 *
 * Run manually:  node server/scripts/session-advancement.js
 * Scheduled:     Runs automatically via Cowork scheduled task on September 1st
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { sendSessionAdvancementEmail } from '../services/email.js'

const MAX_LEVEL = 600

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const now         = new Date()
  const currentYear = now.getFullYear()
  const newSession  = `${currentYear}/${currentYear + 1}`
  const semLabel    = `${newSession}-S1`

  console.log(`\n── Padi Session Advancement ──────────────────`)
  console.log(`Date:        ${now.toISOString()}`)
  console.log(`New session: ${newSession}`)
  console.log(`Semester:    ${semLabel}`)
  console.log(`──────────────────────────────────────────────\n`)

  // ── Idempotency guard ─────────────────────────────────────────────
  // If a current S1 row already exists for this session, the script has
  // already run successfully today. Exit cleanly — no double-advancing.
  const { data: alreadyRun } = await supabase
    .from('school_calendars')
    .select('id')
    .eq('academic_year', newSession)
    .eq('semester', 1)
    .eq('is_current', true)
    .limit(1)

  if (alreadyRun && alreadyRun.length > 0) {
    console.log(`✓ Session ${newSession} already advanced — exiting without changes.\n`)
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
    // ── 2. Advance level for subscribers below the cap ───────────────
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, level, first_name')
      .in('id', activeUserIds)
      .lt('level', MAX_LEVEL)

    if (profErr) throw new Error(`Failed to fetch profiles: ${profErr.message}`)

    let advanced = 0
    for (const profile of (profiles || [])) {
      const newLevel = Math.min((profile.level || 100) + 100, MAX_LEVEL)
      const { error } = await supabase
        .from('profiles')
        .update({ level: newLevel })
        .eq('id', profile.id)
      if (error) {
        console.warn(`  ⚠ Failed to advance ${profile.first_name} (${profile.id}): ${error.message}`)
      } else {
        advanced++
      }
    }
    console.log(`Levels advanced: ${advanced} students`)

    const atCap = activeUserIds.length - (profiles?.length || 0)
    if (atCap > 0) console.log(`Already at 600L (no change): ${atCap} students`)

    // ── 3. Send session advancement emails (fire-and-forget) ─────────
    // Fetch email + name for all active subscribers (not just those who levelled up)
    const { data: emailProfiles } = await supabase
      .from('profiles')
      .select('id, email, first_name, preferred_name, full_name, level')
      .in('id', activeUserIds)

    let emailsSent = 0
    const emailPromises = (emailProfiles || [])
      .filter(p => p.email)
      .map(async (p) => {
        try {
          await sendSessionAdvancementEmail({
            email:         p.email,
            firstName:     p.first_name,
            preferredName: p.preferred_name,
            fullName:      p.full_name,
            newLevel:      p.level || 100,
            newSession,
          })
          emailsSent++
        } catch (emailErr) {
          console.warn(`  ⚠ Email failed for ${p.email}: ${emailErr.message}`)
        }
      })

    await Promise.allSettled(emailPromises)
    console.log(`Session advancement emails sent: ${emailsSent} / ${emailProfiles?.length || 0}`)

    // ── 5. Clear user_courses — students re-enrol for new session ────
    const { error: clearErr } = await supabase
      .from('user_courses')
      .delete()
      .in('user_id', activeUserIds)

    if (clearErr) {
      console.warn(`  ⚠ Failed to clear user courses: ${clearErr.message}`)
    } else {
      console.log(`Course selections cleared — students will re-enrol`)
    }

    // ── 5b. Clear solve_credits — credits reset each academic session ─
    // Orphaned credit rows from old courses would block re-enrollment
    // credit grants. Deleting them ensures fresh credits are created
    // when students enrol in their new-semester courses.
    const { error: creditsErr } = await supabase
      .from('solve_credits')
      .delete()
      .in('user_id', activeUserIds)

    if (creditsErr) {
      console.warn(`  ⚠ Failed to clear solve credits: ${creditsErr.message}`)
    } else {
      console.log(`Solve credits cleared — will be re-granted on course re-enrolment`)
    }

    // ── 6. Clear study packs — fresh start each academic year ─────────
    const { error: packsErr } = await supabase
      .from('study_packs')
      .delete()
      .in('user_id', activeUserIds)

    if (packsErr) {
      console.warn(`  ⚠ Failed to clear study packs: ${packsErr.message}`)
    } else {
      console.log(`Study packs cleared — students start fresh this session`)
    }
  }

  // ── 7. Update school calendars ─────────────────────────────────────
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

    // Insert (or update) the new session's first semester as current
    const { error: calErr } = await supabase
      .from('school_calendars')
      .upsert({
        school_id:      school.id,
        academic_year:  newSession,
        semester:       1,
        semester_label: semLabel,
        start_date:     `${currentYear}-09-01`,
        end_date:       `${currentYear + 1}-01-31`,
        is_current:     true,
      }, { onConflict: 'school_id,semester_label' })

    if (calErr) {
      console.warn(`  ⚠ Calendar error for ${school.name}: ${calErr.message}`)
    } else {
      console.log(`  ✓ ${school.name} → ${semLabel}`)
    }
  }

  console.log(`\n── Advancement complete ──────────────────────\n`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n✗ Session advancement failed:', err.message)
    process.exit(1)
  })
