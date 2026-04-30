import { Resend } from 'resend'
import 'dotenv/config'

const resend  = new Resend(process.env.RESEND_API_KEY)
const FROM    = process.env.RESEND_FROM || 'Padi <onboarding@resend.dev>'
const APP_URL = process.env.CLIENT_URL  || 'http://localhost:5173'

// In dev, all emails go to your own inbox (Resend restriction)
// In production, emails go to the actual user
const getTo = (email) =>
  process.env.NODE_ENV === 'production'
    ? email
    : (process.env.RESEND_DEV_EMAIL || email)

export async function sendWaitlistEmail({ email, firstName, fullName }) {
  const name = firstName || fullName?.split(' ')[0] || 'there'

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `You're in, ${name} — your Padi founding spot is secured`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#4F46E5; padding:32px; text-align:center; }
    .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
    .logo-sub { font-size:12px; color:rgba(255,255,255,0.6); margin-top:4px; }
    .body { padding:36px 32px; }
    .greeting { font-size:22px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
    .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
    .highlight-box { background:#EEF2FF; border-radius:12px; padding:20px 24px; margin:24px 0; }
    .highlight-box p { margin:6px 0; font-size:14px; color:#3730A3; }
    .highlight-box strong { color:#4F46E5; }
    .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:16px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:28px 0; }
    .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
    .footer p { font-size:12px; color:#999; margin:4px 0; line-height:1.6; }
    .footer a { color:#4F46E5; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">PADI</div>
      <div class="logo-sub">Your AI Study Partner</div>
    </div>
    <div class="body">
      <div class="greeting">Hey ${name} 👋</div>
      <p class="text">
        You just secured one of the <strong>100 founding spots</strong> on Padi.
        Your price is locked at <strong>₦1,500 for your first month</strong>,
        then <strong>₦3,000/month forever</strong> — even if we raise prices later.
      </p>
      <div class="highlight-box">
        <p>🌟 <strong>Your founding member benefits</strong></p>
        <p>✓ Early access before public launch</p>
        <p>✓ ₦1,500 first month (50% off)</p>
        <p>✓ ₦3,000/month locked forever after that</p>
        <p>✓ Direct line to the Padi founding team</p>
      </div>
      <p class="text">Click below to create your account and get in right now.</p>
      <a href="${APP_URL}/signup" class="cta-btn">Get early access →</a>
      <p class="text" style="font-size:13px;color:#999;">
        Questions? Reply to this email or reach us at support@yourpadi.com — we respond fast.
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this because you joined the Padi first cohort.</p>
      <p>Padi is a product of <a href="https://yourpadi.com">Syca</a> · yourpadi.com</p>
      <p style="margin-top:8px;color:#BBB;">🛡️ 48-hour full refund policy. Cancel any time.</p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) { console.error('Resend waitlist error:', error); return { success: false, error } }
    console.log('Waitlist email sent to', email, '— id:', data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Email send failed:', err)
    return { success: false, error: err.message }
  }
}

export async function sendRenewalReminderEmail({ email, firstName, fullName, renewalDate, amount }) {
  const name = firstName || fullName?.split(' ')[0] || 'there'
  const dateStr = renewalDate ? new Date(renewalDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'in 3 days'
  const amountStr = amount ? `₦${Number(amount).toLocaleString()}` : '₦3,000'

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Heads up — your Padi subscription renews ${dateStr}`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#4F46E5; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .info-box { background:#EEF2FF; border-radius:12px; padding:20px 24px; margin:24px 0; }
  .info-box p { margin:6px 0; font-size:14px; color:#3730A3; }
  .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:24px 0; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name} 👋</div>
    <p class="text">Just a heads up — your Padi subscription will automatically renew on <strong>${dateStr}</strong>.</p>
    <div class="info-box">
      <p>📅 <strong>Renewal date:</strong> ${dateStr}</p>
      <p>💳 <strong>Amount:</strong> ${amountStr}</p>
      <p>✅ <strong>Access continues uninterrupted</strong></p>
    </div>
    <p class="text">No action needed if you'd like to continue. If you want to cancel before the renewal, you can do so from your account settings.</p>
    <a href="${APP_URL}/dashboard" class="cta-btn">Continue studying →</a>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Renewal reminder email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Renewal reminder email failed:', err)
    return { success: false, error: err.message }
  }
}

export async function sendPaymentFailedEmail({ email, firstName, fullName, gracePeriodEnd }) {
  const name = firstName || fullName?.split(' ')[0] || 'there'
  const graceDate = gracePeriodEnd
    ? new Date(gracePeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })
    : 'in 3 days'

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Action needed — your Padi payment didn't go through`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#DC2626; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .warning-box { background:#FEF2F2; border-left:4px solid #DC2626; border-radius:8px; padding:16px 20px; margin:20px 0; }
  .warning-box p { margin:6px 0; font-size:14px; color:#991B1B; }
  .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:24px 0; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name} — quick heads up</div>
    <p class="text">We weren't able to process your Padi subscription payment. This sometimes happens with card limits or network issues.</p>
    <div class="warning-box">
      <p>⚠️ <strong>Payment failed</strong></p>
      <p>Your access continues until <strong>${graceDate}</strong> while you sort this out.</p>
      <p>After that, access will pause until payment clears.</p>
    </div>
    <p class="text">To keep your access, simply log in and re-subscribe — it only takes a minute.</p>
    <a href="${APP_URL}/pricing" class="cta-btn">Renew my subscription →</a>
    <p class="text" style="font-size:13px;color:#999;">If this is unexpected, reply to this email and we'll help sort it out.</p>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Payment failed email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Payment failed email send error:', err)
    return { success: false, error: err.message }
  }
}

// ── Session advancement email ─────────────────────────────────────
// Sent to each active subscriber when the annual advancement script runs.
// { email, firstName, preferredName, fullName, newLevel, newSession }
export async function sendSessionAdvancementEmail({ email, firstName, preferredName, fullName, newLevel, newSession }) {
  const name = preferredName || firstName || fullName?.split(' ')[0] || 'there'

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `New session, new level — welcome to ${newSession}, ${name}!`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#4F46E5; padding:32px; text-align:center; }
    .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
    .body { padding:36px 32px; }
    .greeting { font-size:22px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
    .level-badge { display:inline-block; background:#EEF2FF; color:#4F46E5; font-size:18px; font-weight:800; padding:8px 20px; border-radius:24px; margin-bottom:20px; }
    .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
    .tip { background:#F5F3FF; border-left:3px solid #4F46E5; padding:12px 16px; border-radius:0 8px 8px 0; font-size:14px; color:#4338CA; margin:16px 0; }
    .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:16px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:28px 0; }
    .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
    .footer p { font-size:12px; color:#999; margin:4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><div class="logo">PADI</div></div>
    <div class="body">
      <div class="greeting">Congratulations, ${name}! 🎓</div>
      <div class="level-badge">${newLevel}L</div>
      <p class="text">
        The new <strong>${newSession}</strong> academic session has begun and your level has been updated.
        Your course list has been cleared — head to the app to re-enrol in your new semester courses.
      </p>
      <div class="tip">
        💡 <strong>Pro tip:</strong> Upload your new course outlines and lecture notes early — Padi uses them to give you more accurate, personalised answers throughout the session.
      </div>
      <p class="text">
        Your study packs have been reset for a clean start. Any questions you generate this session will be fresh and specific to your ${newLevel}L material.
      </p>
      <a href="${APP_URL}/dashboard" class="cta-btn">Go to my dashboard →</a>
    </div>
    <div class="footer">
      <p>Questions? Email support@yourpadi.com — we respond fast.</p>
      <p>Padi · yourpadi.com</p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) { console.error('Resend advancement email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Session advancement email failed:', err)
    return { success: false, error: err.message }
  }
}

// ── Account deletion emails ────────────────────────────────────────
// Sent immediately when a user requests deletion.
// reactivateUrl includes the signed token for one-click reactivation.
export async function sendAccountDeletionEmail({ email, firstName, preferredName, fullName, reactivateUrl }) {
  const name = preferredName || firstName || fullName?.split(' ')[0] || 'there'
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Your Padi account is scheduled for deletion`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#DC2626; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .warning-box { background:#FEF2F2; border-left:4px solid #DC2626; border-radius:8px; padding:16px 20px; margin:20px 0; }
  .warning-box p { margin:6px 0; font-size:14px; color:#991B1B; }
  .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:24px 0; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name}</div>
    <p class="text">We've received your request to delete your Padi account. This is what happens next:</p>
    <div class="warning-box">
      <p>⏳ <strong>Your account is scheduled for deletion in 30 days.</strong></p>
      <p>Until then, you will not be able to sign in.</p>
      <p>After 30 days, all your personal data will be permanently and irreversibly deleted.</p>
    </div>
    <p class="text">Changed your mind? You can reactivate your account any time within the next 30 days by clicking the button below — no questions asked.</p>
    <a href="${reactivateUrl}" class="cta-btn">Reactivate my account →</a>
    <p class="text" style="font-size:13px;color:#999;">
      If you didn't request this, please contact us immediately at support@yourpadi.com.
    </p>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Account deletion email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Account deletion email failed:', err)
    return { success: false, error: err.message }
  }
}

// Sent after 30-day window expires (triggered by a cron / manual wipe).
export async function sendAccountPermanentlyDeletedEmail({ email, firstName, preferredName, fullName }) {
  const name = preferredName || firstName || fullName?.split(' ')[0] || 'there'
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Your Padi account has been permanently deleted`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#6B7280; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name}</div>
    <p class="text">Your Padi account and all associated personal data have been permanently deleted as requested. We're sorry to see you go.</p>
    <p class="text">If you ever want to come back, you're welcome to create a new account at <a href="${APP_URL}/signup" style="color:#4F46E5">yourpadi.com</a>.</p>
    <p class="text" style="font-size:13px;color:#999;">
      Think this was a mistake? Reply to this email and we'll look into it.
    </p>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Permanent deletion email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Permanent deletion email failed:', err)
    return { success: false, error: err.message }
  }
}

export async function sendWelcomeEmail({ email, firstName, fullName }) {
  const name = firstName || fullName?.split(' ')[0] || 'there'

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Welcome to Padi, ${name} — let's get you passing`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#4F46E5; padding:32px; text-align:center; }
    .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
    .body { padding:36px 32px; }
    .greeting { font-size:22px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
    .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
    .feature { display:flex; gap:12px; margin:12px 0; align-items:flex-start; }
    .feature-icon { font-size:20px; flex-shrink:0; }
    .feature-text { font-size:14px; color:#444; line-height:1.5; }
    .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:16px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:28px 0; }
    .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
    .footer p { font-size:12px; color:#999; margin:4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><div class="logo">PADI</div></div>
    <div class="body">
      <div class="greeting">Welcome, ${name}! 🎉</div>
      <p class="text">Your account is active. Here's what you can do right now:</p>
      <div class="feature"><div class="feature-icon">💬</div><div class="feature-text"><strong>Ask Padi anything</strong> — type any question from your course and get a clear, cited explanation instantly.</div></div>
      <div class="feature"><div class="feature-icon">📦</div><div class="feature-text"><strong>Generate a study pack</strong> — upload your notes or type a topic and Padi builds notes, flashcards, and a quiz automatically.</div></div>
      <div class="feature"><div class="feature-icon">🎯</div><div class="feature-text"><strong>Run an exam simulation</strong> — timed, scored mock exams built from your material. Padi identifies your weak areas.</div></div>
      <div class="feature"><div class="feature-icon">🔮</div><div class="feature-text"><strong>Analyse past questions</strong> — upload past papers and Padi predicts the most likely exam topics.</div></div>
      <a href="${APP_URL}/dashboard" class="cta-btn">Start studying with Padi →</a>
    </div>
    <div class="footer">
      <p>Questions? Email support@yourpadi.com — we respond fast.</p>
      <p>Padi · yourpadi.com</p>
    </div>
  </div>
</body>
</html>`,
    })

    if (error) { console.error('Resend welcome error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Welcome email failed:', err)
    return { success: false, error: err.message }
  }
}

// ── Subscription pause confirmation ──────────────────────────────
export async function sendPauseConfirmationEmail({ email, firstName, preferredName, fullName, pausedUntil, months }) {
  const name    = preferredName || firstName || fullName?.split(' ')[0] || 'there'
  const dateStr = new Date(pausedUntil).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Your Padi subscription is paused until ${dateStr}`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#F59E0B; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .info-box { background:#FFFBEB; border-left:4px solid #F59E0B; border-radius:8px; padding:16px 20px; margin:20px 0; }
  .info-box p { margin:6px 0; font-size:14px; color:#92400E; }
  .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:24px 0; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name} ⏸</div>
    <p class="text">Your Padi subscription has been paused for ${months} month${months > 1 ? 's' : ''}. Access will automatically resume on <strong>${dateStr}</strong>.</p>
    <div class="info-box">
      <p>⏸ <strong>Paused until:</strong> ${dateStr}</p>
      <p>🔒 Access is currently blocked</p>
      <p>⏰ Your billing period will be extended by the pause duration when you resume</p>
    </div>
    <p class="text">Back early? You can resume access at any time from your account settings — your subscription period will be extended so you don't lose any paid time.</p>
    <a href="${APP_URL}/account" class="cta-btn">Resume early →</a>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Pause confirmation email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Pause confirmation email failed:', err)
    return { success: false, error: err.message }
  }
}

// ── Subscription resume confirmation ─────────────────────────────
export async function sendResumeConfirmationEmail({ email, firstName, preferredName, fullName, newPeriodEnd }) {
  const name    = preferredName || firstName || fullName?.split(' ')[0] || 'there'
  const dateStr = new Date(newPeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Welcome back — your Padi access is restored`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#4F46E5; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .info-box { background:#EEF2FF; border-left:4px solid #4F46E5; border-radius:8px; padding:16px 20px; margin:20px 0; }
  .info-box p { margin:6px 0; font-size:14px; color:#3730A3; }
  .cta-btn { display:block; background:#4F46E5; color:white; text-decoration:none; text-align:center; padding:14px 32px; border-radius:10px; font-size:15px; font-weight:700; margin:24px 0; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Welcome back, ${name}! ▶</div>
    <p class="text">Your Padi subscription has been resumed and you have full access again. We've extended your billing period to make up for the time you paused.</p>
    <div class="info-box">
      <p>✅ <strong>Access restored immediately</strong></p>
      <p>📅 <strong>New period end:</strong> ${dateStr}</p>
    </div>
    <a href="${APP_URL}/dashboard" class="cta-btn">Back to studying →</a>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Resume confirmation email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Resume confirmation email failed:', err)
    return { success: false, error: err.message }
  }
}

// ── Admin-initiated account deletion notification ─────────────────
// Sent when an admin soft-deletes a student (no reactivation link — admin
// deletions are final unless the student contacts support).
export async function sendAdminDeletionEmail({ email, firstName, preferredName, fullName }) {
  const name = preferredName || firstName || fullName?.split(' ')[0] || 'there'
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      getTo(email),
      subject: `Your Padi account has been suspended`,
      html: `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><style>
  body { margin:0; padding:0; background:#F5F5F0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrapper { max-width:560px; margin:40px auto; background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .header { background:#6B7280; padding:32px; text-align:center; }
  .logo { font-size:22px; font-weight:700; color:white; letter-spacing:4px; }
  .body { padding:36px 32px; }
  .greeting { font-size:20px; font-weight:700; color:#0C0C14; margin-bottom:16px; }
  .text { font-size:15px; color:#555; line-height:1.7; margin-bottom:16px; }
  .footer { background:#F9F9F7; padding:24px 32px; border-top:1px solid #EBEBEB; }
  .footer p { font-size:12px; color:#999; margin:4px 0; }
  .footer a { color:#4F46E5; text-decoration:none; }
</style></head>
<body><div class="wrapper">
  <div class="header"><div class="logo">PADI</div></div>
  <div class="body">
    <div class="greeting">Hey ${name}</div>
    <p class="text">Your Padi account has been suspended by our team. If you believe this was done in error, please reach out to us and we'll look into it.</p>
    <p class="text">Contact us at <a href="mailto:support@yourpadi.com" style="color:#4F46E5">support@yourpadi.com</a> and we'll respond within 24 hours.</p>
  </div>
  <div class="footer">
    <p>Questions? <a href="mailto:support@yourpadi.com">support@yourpadi.com</a></p>
    <p>Padi · <a href="https://yourpadi.com">yourpadi.com</a></p>
  </div>
</div></body></html>`,
    })
    if (error) { console.error('Admin deletion email error:', error); return { success: false, error } }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('Admin deletion email failed:', err)
    return { success: false, error: err.message }
  }
}