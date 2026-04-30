import { Router } from 'express'
import { waitlistLimiter } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../db/supabase.js'
import { sendWaitlistEmail } from '../services/email.js'

const router = Router()

router.post('/', waitlistLimiter, async (req, res) => {
  try {
    const { fullName, dob, email, university, course, whatsapp } = req.body

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Name and email are required.' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' })
    }

    const { error } = await supabaseAdmin
      .from('waitlist')
      .insert({ full_name: fullName, dob, email, university, course, whatsapp })

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This email is already on the waitlist.' })
      }
      throw error
    }

    // Send personalised email — non-blocking, signup succeeds even if email fails
    sendWaitlistEmail({ email, fullName }).catch(err =>
      console.error('Waitlist email failed silently:', err)
    )

    res.status(201).json({ success: true })
  } catch (err) {
    console.error('Waitlist error:', err)
    res.status(500).json({ error: 'Failed to join waitlist. Please try again.' })
  }
})

export default router