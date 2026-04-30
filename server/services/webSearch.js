/**
 * webSearch.js — Tavily web search integration
 *
 * Tavily is purpose-built for AI RAG use cases: it returns clean text
 * snippets (not raw HTML) and an optional answer summary. Free tier
 * gives 1,000 searches/month — plenty for early Padi usage.
 *
 * Setup:
 *   1. Sign up at tavily.com
 *   2. Copy your API key
 *   3. Add to server/.env:  TAVILY_API_KEY=tvly-xxxxxx
 */

const TAVILY_URL = 'https://api.tavily.com/search'

/**
 * Search the web for a query and return clean text snippets.
 * @param {string} query
 * @param {number} maxResults — how many source snippets to return (default 3)
 * @returns {Promise<{ answer: string, results: Array }>}
 */
export async function searchWeb(query, maxResults = 3) {
  const key = process.env.TAVILY_API_KEY
  if (!key) throw new Error('TAVILY_API_KEY is not set in server/.env')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)

  try {
    const res = await fetch(TAVILY_URL, {
      method:  'POST',
      signal:  controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:      key,
        query,
        search_depth: 'basic',   // 'basic' = 1 credit, 'advanced' = 2 credits
        max_results:  maxResults,
        include_answer:       true,   // Tavily's own AI summary of results
        include_raw_content:  false,  // keep responses small
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Tavily error ${res.status}: ${body}`)
    }

    return await res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Web search timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Format Tavily results into a concise context block for injection
 * into an Anthropic prompt. Keeps the context tight to avoid
 * token waste.
 *
 * @param {object} tavilyData — raw response from searchWeb()
 * @returns {string}
 */
export function formatWebContext(tavilyData) {
  const parts = ['[Web search results — use these as supplementary context only, still apply your academic expertise]\n']

  if (tavilyData.answer) {
    parts.push(`Summary: ${tavilyData.answer}`)
  }

  if (tavilyData.results?.length) {
    tavilyData.results.slice(0, 3).forEach((r, i) => {
      const snippet = r.content?.substring(0, 400)?.trim()
      if (snippet) {
        parts.push(`\nSource ${i + 1} — ${r.title}\n${snippet}`)
      }
    })
  }

  return parts.join('\n')
}
