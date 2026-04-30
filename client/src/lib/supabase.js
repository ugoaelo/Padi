import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// AUTH TOKEN STORAGE — KNOWN TRADEOFF
// Supabase stores JWTs in localStorage by default (standard SPA pattern).
// Known risk: tokens are readable by any JS on the page (XSS).
// Accepted at launch because:
//   - No financial data is stored server-side
//   - No user-generated HTML is rendered without sanitisation
//   - The XSS surface is small (no comments, forums, or rich text editor)
//
// POST-LAUNCH migration path (do after first 100 users, not before):
//   1. npm install @supabase/ssr in /client
//   2. Create GET /api/auth/session and POST /api/auth/set-session Express endpoints
//      that proxy Supabase tokens into HttpOnly cookies via the @supabase/ssr server client
//   3. Replace this client with createBrowserClient() from @supabase/ssr
//   4. Update AuthContext to call the proxy endpoints on sign-in/sign-out
//   See: https://supabase.com/docs/guides/auth/server-side/creating-a-client
export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
    storage:             window.localStorage,
  },
})
