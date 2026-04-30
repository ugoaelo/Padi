/**
 * Padi Service Worker — offline library support
 *
 * Cache strategies:
 *  - Library API (/api/user/library): stale-while-revalidate
 *    → serves cached library immediately when offline; updates in background when online
 *  - Static assets (.js, .css, fonts, images): cache-first
 *    → Vite content-hashes filenames so cached assets never go stale
 *  - HTML navigation: network-first, fall back to cached index.html (SPA routing)
 *  - All other API routes: network-only (AI, auth, payments must be fresh)
 *
 * Version bump clears old caches on activate.
 */

const CACHE_VERSION = 'padi-v2'
const SHELL_CACHE   = `${CACHE_VERSION}-shell`
const LIBRARY_CACHE = `${CACHE_VERSION}-library`
const ASSET_CACHE   = `${CACHE_VERSION}-assets`
const ALL_CACHES    = [SHELL_CACHE, LIBRARY_CACHE, ASSET_CACHE]

// Core app shell files to cache on install
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json']

// ── Install ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {}) // Non-fatal if offline at install time
  )
  self.skipWaiting()
})

// ── Activate — clean all old caches ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // ── 1. Library API: stale-while-revalidate ─────────────────────
  // Students on bad internet can still browse their saved library.
  if (url.pathname.startsWith('/api/user/library')) {
    event.respondWith(staleWhileRevalidate(request, LIBRARY_CACHE))
    return
  }

  // ── 2. Other API calls: network-only ──────────────────────────
  // Never serve stale AI responses, auth tokens, or payment data.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'You appear to be offline. Check your connection and try again.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    )
    return
  }

  // ── 3. Static assets: cache-first ─────────────────────────────
  // Vite content-hashes JS/CSS so stale is never a concern.
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|gif|ico|webp)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // ── 4. HTML navigation: network-first, fall back to shell ──────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/')
        return cached || new Response(
          'You are offline. Please reconnect to use Padi.',
          { status: 503, headers: { 'Content-Type': 'text/plain' } }
        )
      })
    )
    return
  }

  // ── 5. Everything else: pass through ─────────────────────────
  event.respondWith(fetch(request))
})

// ── Helpers ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Asset not available offline.', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Always try to refresh in the background
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)

  // Return stale immediately if available, otherwise wait for network
  return cached || networkPromise
}

// ── Background sync placeholder ───────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'padi-sync') {
    console.log('Padi background sync triggered')
  }
})
