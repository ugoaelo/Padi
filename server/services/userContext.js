import { supabaseAdmin } from '../db/supabase.js'

// ── Save a document summary to the user's personal context store ──
// Called after /summarise or /study-pack (document source).
// Non-blocking — errors are swallowed so they never break the main flow.
export async function saveUserDocument({ userId, title, subject, summary, sourceType = 'upload' }) {
  if (!userId || !summary) return
  try {
    await supabaseAdmin.from('user_documents').insert({
      user_id:     userId,
      title:       (title || 'Uploaded document').substring(0, 200),
      subject:     subject || null,
      summary:     summary.substring(0, 3000),
      source_type: sourceType,
    })
  } catch (err) {
    console.warn('saveUserDocument failed (non-blocking):', err.message)
  }
}

// ── Get recent document summaries for a user (personalised context) ──
// Returns a string to inject into AI system prompts.
// Privacy: NEVER cached — stays user-specific, never shared across users.
export async function getUserDocumentContext(userId, subject) {
  if (!userId) return null
  try {
    let query = supabaseAdmin
      .from('user_documents')
      .select('title, summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3)

    // Prefer subject-matched docs, fall back to any recent docs if none found
    if (subject) {
      const { data: matched } = await query.ilike('subject', `%${subject}%`)
      if (matched?.length) {
        return matched.map(d => `[${d.title || 'Your notes'}]: ${d.summary.substring(0, 600)}`).join('\n\n')
      }
    }

    const { data } = await query
    if (!data?.length) return null
    return data.map(d => `[${d.title || 'Your notes'}]: ${d.summary.substring(0, 600)}`).join('\n\n')
  } catch { return null }
}

// ── Get relevant entries from the admin knowledge base ────────────
// Shared across all users — safe to cache alongside AI responses.
export async function getKnowledgeBaseContext(subject) {
  if (!subject) return null
  try {
    const { data } = await supabaseAdmin
      .from('knowledge_base')
      .select('title, summary')
      .ilike('subject', `%${subject}%`)
      .not('summary', 'is', null)
      .limit(2)
    if (!data?.length) return null
    return data.map(d => `[${d.title}]: ${d.summary.substring(0, 600)}`).join('\n\n')
  } catch { return null }
}
