/**
 * Maaldhis PWA Service Worker (v4)
 * Comprehensive SPA Offline Navigation Fallback, Universal Manifest Pre-Caching & Isolated Inertia Routing Engine.
 * Ensures all system pages, assets, and routes are available offline regardless of entry point.
 */

const CACHE_VERSION = 'maaldhis-pwa-v4';
const STATIC_CACHE = `maaldhis-static-${CACHE_VERSION}`;
const HTML_SHELL_CACHE = `maaldhis-html-${CACHE_VERSION}`;
const INERTIA_DATA_CACHE = `maaldhis-inertia-${CACHE_VERSION}`;
const API_CACHE = `maaldhis-api-${CACHE_VERSION}`;

let lastKnownAuth = null;
let lastKnownStores = [];
let lastKnownBranding = { system_name: 'Maaldhis' };

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.svg',
  '/favicon.ico',
];

const SW_ROUTE_PAGE_MAP = {
  '/': 'DashboardPage',
  '/dashboard': 'DashboardPage',
  '/pos': 'StartSalePage',
  '/start-sale': 'StartSalePage',
  '/sale': 'StartSalePage',
  '/customer-display': 'CustomerDisplayPage',
  '/inventory': 'InventoryPage',
  '/categories': 'CategoriesPage',
  '/customers': 'CustomersPage',
  '/suppliers': 'SuppliersPage',
  '/sales-report': 'SalesReportPage',
  '/purchases': 'PurchasesPage',
  '/expenses': 'ExpensesPage',
  '/cash-flow': 'CashFlowPage',
  '/credit-record': 'CreditRecordPage',
  '/returns': 'ReturnsPage',
  '/stock-transfers': 'StockTransfersPage',
  '/stock-report': 'StockReportPage',
  '/receipt-history': 'ReceiptHistoryPage',
  '/staff-accounts': 'StaffAccountsPage',
  '/payment-accounts': 'PaymentAccountsPage',
  '/profile': 'ProfilePage',
  '/preferences': 'PreferencesPage',
  '/store-edit': 'StoreEditPage',
  '/help': 'HelpPage',
  '/learning-center': 'LearningCenterPage',
  '/devices': 'DeviceManagementPage',
  '/upgrade': 'UpgradePage',
  '/create-store': 'CreateStorePage',
  '/setup-wizard': 'SetupWizardPage',
  '/select-store': 'SelectStorePage',
  '/patients': 'dental/PatientsPage',
  '/dental/patients': 'dental/PatientsPage',
  '/appointments': 'dental/AppointmentsPage',
  '/dental-charting': 'dental/DentalChartingPage',
  '/dental-billing': 'dental/DentalBillingPage',
  '/dental-catalog': 'dental/DentalCatalogPage',
  '/dental-doctors': 'dental/DoctorsPage',
  '/doctors': 'dental/DoctorsPage',
  '/license-blocked': 'LicenseBlockPage',
  '/login': 'LoginPage',
  '/signup': 'SignupPage',
  '/reset-password': 'ResetPasswordPage',
  '/admin/dashboard': 'admin/AdminDashboardPage',
  '/admin/stores': 'admin/AdminStoresPage',
  '/admin/licenses': 'admin/AdminLicensesPage',
  '/admin/subscriptions': 'admin/AdminSubscriptionsPage',
  '/admin/payments': 'admin/AdminPaymentsPage',
  '/admin/users': 'admin/AdminUsersPage',
  '/admin/plans': 'admin/AdminPlansPage',
  '/admin/analytics': 'admin/AdminAnalyticsPage',
  '/admin/support': 'admin/AdminSupportPage',
  '/admin/settings': 'admin/AdminSettingsPage',
  '/admin/exchange-rates': 'admin/AdminExchangeRatesPage',
  '/admin/mpesa-settings': 'admin/AdminMpesaSettingsPage',
};

function resolveRouteComponent(pathname) {
  if (SW_ROUTE_PAGE_MAP[pathname]) {
    return { component: SW_ROUTE_PAGE_MAP[pathname], props: {} };
  }
  if (pathname.startsWith('/dental/patients/') && pathname !== '/dental/patients') {
    const parts = pathname.split('/').filter(Boolean);
    return {
      component: 'dental/PatientDetailsPage',
      props: { patientId: parts[parts.length - 1] },
    };
  }
  if (pathname.startsWith('/receipt/')) {
    const parts = pathname.split('/').filter(Boolean);
    return {
      component: 'ReceiptPage',
      props: { saleId: parts[parts.length - 1] },
    };
  }
  return { component: 'DashboardPage', props: {} };
}

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
    return (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<')) && !trimmed.startsWith('{');
  } catch (_) {
    return false;
  }
}

// Helper: precache all chunks and assets from Vite manifest.json
async function precacheViteManifest(cache) {
  try {
    const manifestRes = await fetch('/build/manifest.json', { cache: 'no-cache' });
    if (manifestRes && manifestRes.ok) {
      const manifest = await manifestRes.json();
      const urlsToCache = new Set();
      urlsToCache.add('/build/manifest.json');

      for (const entry of Object.values(manifest)) {
        if (entry.file) urlsToCache.add(`/build/${entry.file}`);
        if (Array.isArray(entry.css)) {
          entry.css.forEach((c) => urlsToCache.add(`/build/${c}`));
        }
        if (Array.isArray(entry.assets)) {
          entry.assets.forEach((a) => urlsToCache.add(`/build/${a}`));
        }
      }

      await Promise.allSettled(
        Array.from(urlsToCache).map((u) => cache.add(u).catch((err) => {
          console.warn('[SW] Manifest asset skipped:', u, err);
        }))
      );
    }
  } catch (err) {
    console.warn('[SW] Could not precache Vite manifest:', err);
  }
}

// 1. Install Event: Pre-cache static shell, Vite chunks manifest, and HTML App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);

      // Pre-cache core root assets
      await staticCache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Initial static precaching partial notice:', err);
      });

      // Pre-cache all generated Vite chunks & assets
      await precacheViteManifest(staticCache);

      // Warm HTML_SHELL_CACHE immediately with root App Shell
      try {
        const rootRes = await fetch('/', {
          credentials: 'same-origin',
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        });
        if (rootRes && rootRes.ok) {
          const isHtml = await isValidHtmlResponse(rootRes);
          if (isHtml) {
            const htmlCache = await caches.open(HTML_SHELL_CACHE);
            await htmlCache.put('/', rootRes.clone());
            await htmlCache.put('/index.html', rootRes.clone());
            await htmlCache.put('__app_shell__', rootRes.clone());
          }
        }
      } catch (_) {}
    })()
  );
});

// 2. Activate Event: Clean up outdated cache stores and claim clients immediately
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
    }).then(() => self.clients.claim()).then(async () => {
      // Ensure any newly added manifest chunks are cached
      const staticCache = await caches.open(STATIC_CACHE);
      await precacheViteManifest(staticCache);
    })
  );
});

// 3. Message Event: Pre-cache HTML App Shells, Inertia route payloads & app session state
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SYNC_APP_STATE') {
    if (event.data.auth) lastKnownAuth = event.data.auth;
    if (event.data.stores) lastKnownStores = event.data.stores;
    if (event.data.systemBranding) lastKnownBranding = event.data.systemBranding;
    return;
  }

  if (event.data.type === 'CACHE_HTML_SHELL' && typeof event.data.html === 'string') {
    const html = event.data.html;
    const response = new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    caches.open(HTML_SHELL_CACHE).then((cache) => {
      cache.put('/index.html', response.clone());
      cache.put('__app_shell__', response.clone());
      cache.put('/', response.clone());
      if (event.data.url) {
        cache.put(event.data.url, response.clone());
      }
    });
    return;
  }

  if (event.data.type === 'PRECACHE_ROUTES') {
    const routes = event.data.routes || [];

    // Pre-cache HTML document shell for each route
    caches.open(HTML_SHELL_CACHE).then((cache) => {
      routes.forEach((route) => {
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
                // Keep App Shell and /index.html updated
                cache.put('__app_shell__', res.clone());
                cache.put('/index.html', res.clone());
              }
            }
          })
          .catch(() => {});
      });
    });

    // Also pre-cache Inertia JSON for client-side visits
    caches.open(INERTIA_DATA_CACHE).then((inertiaCache) => {
      routes.forEach((route) => {
        fetch(route, {
          credentials: 'same-origin',
          headers: {
            'X-Inertia': 'true',
            'Accept': 'text/html, application/xhtml+xml',
          },
        })
          .then(async (res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              inertiaCache.put(route, clone.clone());
              try {
                const fullUrl = new URL(route, self.location.origin).href;
                inertiaCache.put(fullUrl, clone.clone());
              } catch (_) {}

              try {
                const data = await res.json();
                if (data && data.props) {
                  if (data.props.auth?.user) lastKnownAuth = data.props.auth;
                  if (data.props.initialStores?.length) lastKnownStores = data.props.initialStores;
                  if (data.props.systemBranding) lastKnownBranding = data.props.systemBranding;
                }
              } catch (_) {}
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
              cache.put('/index.html', networkResponse.clone());
              cache.put('/', networkResponse.clone());
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

          // 3. Try global App Shell fallback (/index.html, /, __app_shell__)
          candidate = await cache.match('/index.html') || await cache.match('/') || await cache.match('__app_shell__');
          if (await isValidHtmlResponse(candidate)) {
            return candidate;
          }

          // 4. Check static cache for / or /index.html
          const staticCache = await caches.open(STATIC_CACHE);
          candidate = await staticCache.match('/index.html') || await staticCache.match('/');
          if (await isValidHtmlResponse(candidate)) {
            return candidate;
          }

          // 5. Search all keys in HTML_SHELL_CACHE for any valid HTML document
          const keys = await cache.keys();
          for (const req of keys) {
            const res = await cache.match(req);
            if (await isValidHtmlResponse(res)) {
              return res;
            }
          }

          // 6. Return default offline HTML
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
            caches.open(INERTIA_DATA_CACHE).then(async (cache) => {
              cache.put(url.pathname, clone.clone());
              cache.put(request.url, clone.clone());
              try {
                const data = await clone.json();
                if (data && data.props) {
                  if (data.props.auth?.user) lastKnownAuth = data.props.auth;
                  if (data.props.initialStores?.length) lastKnownStores = data.props.initialStores;
                  if (data.props.systemBranding) lastKnownBranding = data.props.systemBranding;
                }
              } catch (_) {}
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(INERTIA_DATA_CACHE);
          let cached = await cache.match(request.url) || await cache.match(url.pathname);
          if (cached) return cached;

          // Resolve target component and route props cleanly from SW_ROUTE_PAGE_MAP
          const { component, props: routeProps } = resolveRouteComponent(url.pathname);
          const inertiaVersion = request.headers.get('x-inertia-version') || '';

          const payload = {
            component,
            props: {
              auth: lastKnownAuth || { user: null },
              initialStores: lastKnownStores || [],
              systemBranding: lastKnownBranding || { system_name: 'Maaldhis' },
              isOfflineFallback: true,
              ...routeProps,
            },
            url: url.pathname,
            version: inertiaVersion,
          };

          return new Response(
            JSON.stringify(payload),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Inertia': 'true',
                'X-Inertia-Version': inertiaVersion,
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
        let cachedResponse = await cache.match(request);
        if (!cachedResponse) {
          cachedResponse = await cache.match(url.pathname, { ignoreSearch: true });
        }
        if (!cachedResponse) {
          cachedResponse = await cache.match(request.url, { ignoreSearch: true });
        }

        if (cachedResponse) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                cache.put(request, networkResponse.clone());
                cache.put(url.pathname, networkResponse.clone());
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
            cache.put(url.pathname, networkResponse.clone());
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
