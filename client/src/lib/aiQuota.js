// Standalone quota constants and helpers — zero imports so this module
// is trivially simple and cannot fail to load regardless of build-tool quirks.

export const AI_DAILY_LIMIT = 40

export function getStoredAIRemaining() {
  try {
    const stored = sessionStorage.getItem('padi_ai_remaining')
    const date   = sessionStorage.getItem('padi_ai_date')
    const today  = new Date().toDateString()
    if (date !== today) {
      sessionStorage.setItem('padi_ai_remaining', String(AI_DAILY_LIMIT))
      sessionStorage.setItem('padi_ai_date', today)
      return AI_DAILY_LIMIT
    }
    return stored !== null ? parseInt(stored, 10) : AI_DAILY_LIMIT
  } catch (_e) { return AI_DAILY_LIMIT }
}

export function storeAIRemaining(remaining) {
  try {
    sessionStorage.setItem('padi_ai_remaining', String(remaining))
    sessionStorage.setItem('padi_ai_date', new Date().toDateString())
    window.dispatchEvent(new CustomEvent('padi:ai-remaining', { detail: { remaining } }))
  } catch (_e) { /* silent */ }
}
