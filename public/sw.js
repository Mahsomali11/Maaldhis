/**
 * Maaldhis PWA Service Worker (v2)
 * Strictly separates HTML document navigation responses from Inertia JSON responses.
 * Prevents raw JSON from ever being returned to browser document navigations.
 */

const CACHE_VERSION = 'maaldhis-pwa-v2';
const STATIC_CACHE = `maaldhis-static-${CACHE_VERSION}`;
const HTML_SHELL_CACHE = `maaldhis-html-${CACHE_VERSION}`;
const INERTIA_DATA_CACHE = `maaldhis-inertia-${CACHE_VERSION}`;
const API_CACHE = `maaldhis-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/pwa-icon.svg',
  '/favicon.ico',
];

// Helper: strictly check if a response is a real HTML document and not JSON
async function isValidHtmlResponse(response) {
  if (!response) return false;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return false;

  try {
    const clone = response.clone();
    const text = await clone.text();
    const trimmed = text.trim();
    // Must start with HTML tag or DOCTYPE, never a JSON object
    return trimmed.startsWith('<') && !trimmed.startsWith('{');
  } catch (_) {
    return false;
  }
}

// 1. Install Event: Pre-cache core shell resources and skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Initial asset precaching partial failure:', err);
      });
    })
  );
});

// 2. Activate Event: Clean up outdated cache stores and claim clients
self.addEventListener('activate', (event) => {
  const allowedCaches = [STATIC_CACHE, HTML_SHELL_CACHE, INERTIA_DATA_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!allowedCaches.includes(key)) {
            console.log('[SW] Purging outdated cache store:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event: Pre-cache HTML App Shells for critical routes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_ROUTES') {
    const routes = event.data.routes || [];
    caches.open(HTML_SHELL_CACHE).then((cache) => {
      routes.forEach((route) => {
        // Explicitly request text/html so Laravel renders app.blade.php
        fetch(route, {
          credentials: 'same-origin',
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        })
          .then(async (res) => {
            if (res && res.status === 200) {
              const isHtml = await isValidHtmlResponse(res);
              if (isHtml) {
                cache.put(route, res.clone());
                try {
                  const fullUrl = new URL(route, self.location.origin).href;
                  cache.put(fullUrl, res.clone());
                } catch (_) {}
                // Ensure we have a valid App Shell fallback
                cache.put('__app_shell__', res.clone());
              }
            }
          })
          .catch(() => {});
      });
    });
  }
});

// 4. Fetch Event: Tailored routing strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations handled client-side via IndexedDB queue)
  if (request.method !== 'GET') {
    return;
  }

  // =========================================================================
  // Strategy A: Full Document Navigation (F5 / Hard Refresh / Address Bar)
  // Must ALWAYS return a verified HTML Application Shell, NEVER raw JSON!
  // =========================================================================
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const isHtml = await isValidHtmlResponse(networkResponse);
            if (isHtml) {
              const cache = await caches.open(HTML_SHELL_CACHE);
              cache.put(request.url, networkResponse.clone());
              cache.put(url.pathname, networkResponse.clone());
              cache.put('__app_shell__', networkResponse.clone());
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          console.warn('[SW] Offline document navigation intercepted for:', request.url);
          const cache = await caches.open(HTML_SHELL_CACHE);

          // 1. Try exact match by full URL
          let candidate = await cache.match(request.url);
          if (await isValidHtmlResponse(candidate)) {
            return candidate;
          }

          // 2. Try match by pathname
          candidate = await cache.match(url.pathname);
          if (await isValidHtmlResponse(candidate)) {
            return candidate;
          }

          // 3. Try global App Shell fallback
          candidate = await cache.match('__app_shell__');
          if (await isValidHtmlResponse(candidate)) {
            return candidate;
          }

          // 4. Search all keys in HTML_SHELL_CACHE for any valid HTML document
          const keys = await cache.keys();
          for (const req of keys) {
            const res = await cache.match(req);
            if (await isValidHtmlResponse(res)) {
              return res;
            }
          }

          // 5. If no cached HTML exists, return clean fallback HTML
          return new Response(getOfflineHtml(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // =========================================================================
  // Strategy B: Inertia AJAX Client-Side Visits (X-Inertia: true)
  // Strictly isolated in INERTIA_DATA_CACHE — never stored in HTML_SHELL_CACHE!
  // =========================================================================
  const isInertia = request.headers.get('x-inertia') === 'true';
  if (isInertia) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(INERTIA_DATA_CACHE).then((cache) => {
              cache.put(url.pathname, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(INERTIA_DATA_CACHE);
          const cached = await cache.match(url.pathname);
          if (cached) return cached;

          // Graceful fallback JSON for client-side navigation while offline
          return new Response(
            JSON.stringify({
              component: 'DashboardPage',
              props: { isOffline: true },
              url: url.pathname,
              version: '',
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Inertia': 'true',
              },
            }
          );
        })
    );
    return;
  }

  // =========================================================================
  // Strategy C: Static Bundles & Assets (/build/*, .js, .css, fonts, images)
  // =========================================================================
  const isStaticAsset =
    url.pathname.startsWith('/build/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.hostname.includes('fonts.bunny.net') ||
    url.hostname.includes('fonts.googleapis.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                cache.put(request, networkResponse);
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('[SW] Failed to fetch static asset offline:', request.url);
          return cachedResponse || new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // =========================================================================
  // Strategy D: GET API Requests (/api/*)
  // =========================================================================
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(API_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true, data: null }), {
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }
});

function getOfflineHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline Mode - Maaldhis</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #F8F9FA;
      color: #1F2937;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: #EEF2FF;
      color: #4F46E5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 10px 0;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 14px;
      color: #6B7280;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      background: #4F46E5;
      color: #FFFFFF;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .btn:hover {
      background: #4338CA;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>Device Currently Offline</h1>
    <p>You are working in offline mode. Once network connectivity is restored, the application will automatically synchronize with cloud servers.</p>
    <button class="btn" onclick="window.location.reload()">Reload Application</button>
  </div>
</body>
</html>`;
}
