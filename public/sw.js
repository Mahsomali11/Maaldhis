/**
 * Maaldhis PWA Service Worker
 * Handles runtime caching, offline app-shell serving, and static asset persistence.
 */

const CACHE_VERSION = 'maaldhis-pwa-v1';
const STATIC_CACHE = `maaldhis-static-${CACHE_VERSION}`;
const PAGE_CACHE = `maaldhis-pages-${CACHE_VERSION}`;
const API_CACHE = `maaldhis-api-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/pwa-icon.svg',
  '/favicon.ico',
];

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
  const allowedCaches = [STATIC_CACHE, PAGE_CACHE, API_CACHE];
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

// 3. Message Event: Allow frontend to request background pre-caching of key routes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_ROUTES') {
    const routes = event.data.routes || [];
    caches.open(PAGE_CACHE).then((cache) => {
      routes.forEach((route) => {
        fetch(route, { credentials: 'same-origin', headers: { 'Accept': 'text/html' } })
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(route, res.clone());
              try {
                const fullUrl = new URL(route, self.location.origin).href;
                cache.put(fullUrl, res.clone());
              } catch (_) {}
            }
          })
          .catch(() => {});
      });
    });
  }
});

// 4. Fetch Event: Intercept network traffic with tailored offline strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations handled client-side via IndexedDB queue)
  if (request.method !== 'GET') {
    return;
  }

  // A. Navigation Requests (Address Bar / Hard Refresh / F5)
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(PAGE_CACHE).then((cache) => {
              // Cache under full URL and pathname
              cache.put(request.url, clone.clone());
              cache.put(url.pathname, clone.clone());
              // Save as primary App Shell fallback
              cache.put('__app_shell__', clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.warn('[SW] Offline navigation intercepted for:', request.url);
          const cache = await caches.open(PAGE_CACHE);

          // 1. Exact match by full URL
          let cachedResponse = await cache.match(request.url);
          if (!cachedResponse) {
            // 2. Match by pathname
            cachedResponse = await cache.match(url.pathname);
          }
          if (!cachedResponse) {
            // 3. Match App Shell fallback
            cachedResponse = await cache.match('__app_shell__');
          }
          if (!cachedResponse) {
            // 4. Match any cached HTML document
            const keys = await cache.keys();
            for (const req of keys) {
              const res = await cache.match(req);
              const contentType = res?.headers?.get('content-type') || '';
              if (contentType.includes('text/html')) {
                cachedResponse = res;
                break;
              }
            }
          }

          if (cachedResponse) {
            return cachedResponse;
          }

          // 5. Emergency offline fallback page
          return new Response(getOfflineHtml(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // B. Inertia Client-Side Visits (X-Inertia: true)
  const isInertia = request.headers.get('x-inertia') === 'true';
  if (isInertia) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(PAGE_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
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

  // C. Static Bundles & Assets (/build/*, .js, .css, fonts, images)
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
          // Stale-while-revalidate in background if online
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse);
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Fetch from network and cache
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

  // D. GET API Requests (/api/*)
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

