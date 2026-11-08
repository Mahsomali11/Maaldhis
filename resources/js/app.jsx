import './index.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppProvider } from '@/context/AppContext';
import { AdminProvider } from '@/context/AdminContext';
import DesktopLayout from '@/components/DesktopLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { initSubmitGuard } from '@/lib/submit-guard';
import { getPlatformName, syncDocumentBranding } from '@/hooks/usePlatformName';

// Route to Page Component Map for Instant Offline Routing
const ROUTE_PAGE_MAP = {
    '/': 'DashboardPage',
    '/dashboard': 'DashboardPage',
    '/pos': 'StartSalePage',
    '/start-sale': 'StartSalePage',
    '/sale': 'StartSalePage',
    '/customer-display': 'CustomerDisplayPage',
    '/inventory': 'InventoryPage',
    '/categories': 'CategoriesPage',
    '/sales-report': 'SalesReportPage',
    '/customers': 'CustomersPage',
    '/suppliers': 'SuppliersPage',
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

// Initialize global double-click & duplicate submission guard
initSubmitGuard();

// Global client-side fetch interceptor: guarantees Inertia navigation never fails when offline
if (typeof window !== 'undefined') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const requestHeaders = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
        const isInertia = requestHeaders.get('x-inertia') === 'true';

        if (isOffline && isInertia) {
            try {
                // Let service worker respond if active
                const swRes = await nativeFetch(input, init);
                if (swRes && swRes.status === 200) {
                    return swRes;
                }
            } catch (_) {}

            const rawUrl = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
            let pathname = '/';
            try {
                pathname = new URL(rawUrl, window.location.origin).pathname;
            } catch (_) {
                pathname = rawUrl;
            }

            const inertiaVersion = requestHeaders.get('x-inertia-version') || '';
            let matchedComp = ROUTE_PAGE_MAP[pathname] || 'DashboardPage';
            let extraProps = {};

            if (pathname.startsWith('/dental/patients/') && pathname !== '/dental/patients') {
                matchedComp = 'dental/PatientDetailsPage';
                extraProps.patientId = pathname.split('/').filter(Boolean).pop();
            } else if (pathname.startsWith('/receipt/')) {
                matchedComp = 'ReceiptPage';
                extraProps.saleId = pathname.split('/').filter(Boolean).pop();
            }

            let cachedUser = null;
            let cachedStores = [];
            try {
                const u = localStorage.getItem('cached_auth_user');
                if (u) cachedUser = JSON.parse(u);
                const s = localStorage.getItem('cached_stores');
                if (s) cachedStores = JSON.parse(s);
            } catch (_) {}

            const payload = {
                component: matchedComp,
                props: {
                    auth: { user: cachedUser },
                    initialStores: cachedStores,
                    systemBranding: { system_name: 'Maaldhis' },
                    isOfflineFallback: true,
                    ...extraProps,
                },
                url: pathname,
                version: inertiaVersion,
            };

            return new Response(JSON.stringify(payload), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Inertia': 'true',
                    'X-Inertia-Version': inertiaVersion,
                },
            });
        }

        return nativeFetch(input, init);
    };
}

// Global Inertia offline navigation resilience
router.on('exception', (event) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const errorMsg = event.detail?.exception?.message || '';
    const isNetworkError =
        isOffline ||
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('NetworkError') ||
        errorMsg.includes('network error') ||
        errorMsg.includes('Load failed');

    if (isNetworkError) {
        event.preventDefault();
        console.warn('[Inertia Router] Intercepted offline navigation network exception:', errorMsg);
    }
});

router.on('invalid', (event) => {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
        event.preventDefault();
        console.warn('[Inertia Router] Intercepted invalid response while offline');
    }
});

// Guard router.visit calls against unhandled offline rejections
const originalRouterVisit = router.visit.bind(router);
router.visit = (url, options = {}) => {
    const wrappedOptions = {
        ...options,
        onError: (errors) => {
            if (options.onError) options.onError(errors);
        },
        onCancel: () => {
            if (options.onCancel) options.onCancel();
        },
        onFinish: (visit) => {
            if (options.onFinish) options.onFinish(visit);
        },
    };

    try {
        return originalRouterVisit(url, wrappedOptions);
    } catch (err) {
        console.warn('[Inertia Router] Synchronous error in router.visit intercepted:', err);
    }
};

// Preserve authenticated user and store state across all offline Inertia navigations
router.on('navigate', (event) => {
    const page = event.detail?.page;
    if (page && page.props) {
        let cachedUser = null;
        let cachedStores = [];
        try {
            const u = localStorage.getItem('cached_auth_user');
            if (u) cachedUser = JSON.parse(u);
            const s = localStorage.getItem('cached_stores');
            if (s) cachedStores = JSON.parse(s);
        } catch (_) {}

        if (!page.props.auth?.user && cachedUser) {
            if (!page.props.auth) page.props.auth = {};
            page.props.auth.user = cachedUser;
        }
        if ((!page.props.initialStores || page.props.initialStores.length === 0) && cachedStores?.length) {
            page.props.initialStores = cachedStores;
        }
        if (!page.props.systemBranding) {
            page.props.systemBranding = { system_name: 'Maaldhis' };
        }
    }
});

const ALL_SYSTEM_ROUTES = [
    '/dashboard',
    '/start-sale',
    '/pos',
    '/sale',
    '/inventory',
    '/categories',
    '/customers',
    '/suppliers',
    '/purchases',
    '/sales-report',
    '/expenses',
    '/cash-flow',
    '/credit-record',
    '/returns',
    '/stock-transfers',
    '/stock-report',
    '/receipt-history',
    '/staff-accounts',
    '/payment-accounts',
    '/profile',
    '/preferences',
    '/store-edit',
    '/help',
    '/learning-center',
    '/devices',
    '/upgrade',
    '/create-store',
    '/setup-wizard',
    '/select-store',
    '/patients',
    '/dental/patients',
    '/appointments',
    '/dental-charting',
    '/dental-billing',
    '/dental-catalog',
    '/doctors',
    '/dental-doctors',
];

// Register PWA Service Worker for seamless offline caching & refresh support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
                const sendPrecache = (sw) => {
                    if (sw) {
                        sw.postMessage({
                            type: 'PRECACHE_ROUTES',
                            routes: ALL_SYSTEM_ROUTES,
                        });

                        // Sync local auth user and stores
                        try {
                            const u = localStorage.getItem('cached_auth_user');
                            const s = localStorage.getItem('cached_stores');
                            sw.postMessage({
                                type: 'SYNC_APP_STATE',
                                auth: u ? { user: JSON.parse(u) } : null,
                                stores: s ? JSON.parse(s) : [],
                            });
                        } catch (_) {}

                        // Persist current page HTML shell
                        try {
                            sw.postMessage({
                                type: 'CACHE_HTML_SHELL',
                                html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
                                url: window.location.pathname,
                            });
                        } catch (_) {}
                    }
                };

                if (registration.active) {
                    sendPrecache(registration.active);
                }
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                sendPrecache(newWorker);
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.warn('[PWA] Service Worker registration failed:', error);
            });
    });
}

const queryClient = new QueryClient();

// Extract Inertia page data to fix compatibility with Laravel 10+ inertia adapter
let initialPageData = null;
const appEl = document.getElementById('app');
if (appEl && appEl.dataset.page) {
    try {
        initialPageData = JSON.parse(appEl.dataset.page);
    } catch (_) {}
} else {
    const scriptEl = document.querySelector('script[data-page="app"]');
    if (scriptEl && scriptEl.textContent) {
        try {
            initialPageData = JSON.parse(scriptEl.textContent);
        } catch (_) {}
    }
}


if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    const isDynamicPatient = currentPath.startsWith('/dental/patients/') && currentPath !== '/dental/patients';
    const isReceipt = currentPath.startsWith('/receipt/');
    const patientId = isDynamicPatient ? currentPath.split('/').filter(Boolean).pop() : undefined;
    const saleId = isReceipt ? currentPath.split('/').filter(Boolean).pop() : undefined;

    let cachedUser = null;
    let cachedStores = [];
    try {
        const u = localStorage.getItem('cached_auth_user');
        if (u) cachedUser = JSON.parse(u);
        const s = localStorage.getItem('cached_stores');
        if (s) cachedStores = JSON.parse(s);
    } catch (_) {}

    if (initialPageData) {
        // If an offline reload served the base App Shell whose URL doesn't match current route
        if (ROUTE_PAGE_MAP[currentPath] && initialPageData.url !== currentPath) {
            initialPageData.component = ROUTE_PAGE_MAP[currentPath];
            initialPageData.url = currentPath;
        } else if (isDynamicPatient && initialPageData.component !== 'dental/PatientDetailsPage') {
            initialPageData.component = 'dental/PatientDetailsPage';
            initialPageData.url = currentPath;
            if (initialPageData.props) {
                initialPageData.props.patientId = patientId;
            }
        } else if (isReceipt && initialPageData.component !== 'ReceiptPage') {
            initialPageData.component = 'ReceiptPage';
            initialPageData.url = currentPath;
            if (initialPageData.props) {
                initialPageData.props.saleId = saleId;
            }
        }

        // Ensure safe hydration on props to prevent undefined crashes
        if (!initialPageData.props) initialPageData.props = {};
        if (!initialPageData.props.auth) initialPageData.props.auth = { user: cachedUser };
        else if (!initialPageData.props.auth.user && cachedUser) initialPageData.props.auth.user = cachedUser;
        if (!initialPageData.props.initialStores && cachedStores.length > 0) initialPageData.props.initialStores = cachedStores;
        if (!initialPageData.props.systemBranding) initialPageData.props.systemBranding = { system_name: 'Maaldhis' };
    } else {
        // Fallback if data-page attribute is missing
        let matchedComp = ROUTE_PAGE_MAP[currentPath] || 'DashboardPage';
        let extraProps = {};
        if (isDynamicPatient) {
            matchedComp = 'dental/PatientDetailsPage';
            extraProps.patientId = patientId;
        } else if (isReceipt) {
            matchedComp = 'ReceiptPage';
            extraProps.saleId = saleId;
        }

        initialPageData = {
            component: matchedComp,
            props: {
                auth: { user: cachedUser },
                initialStores: cachedStores,
                systemBranding: { system_name: 'Maaldhis' },
                isOfflineFallback: true,
                ...extraProps,
            },
            url: currentPath,
            version: '',
        };
    }
}

const pages = import.meta.glob('./pages/**/*.tsx');

// Universal dynamic chunk warming during online idle time
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        if (navigator.onLine) {
            const warmChunks = () => {
                Object.values(pages).forEach((loader) => {
                    try {
                        loader().catch(() => {});
                    } catch (_) {}
                });
            };

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(warmChunks, { timeout: 3500 });
            } else {
                setTimeout(warmChunks, 2000);
            }
        }
    });
}

createInertiaApp({
    title: (title) => title ? `${title} - ${getPlatformName()}` : getPlatformName(),
    page: initialPageData,
    resolve: async (name) => {
        let importPage = pages[`./pages/${name}.tsx`];
        if (!importPage) {
            const fallbackKey = Object.keys(pages).find(k => k.toLowerCase().endsWith(`/${name.toLowerCase()}.tsx`));
            if (fallbackKey) {
                importPage = pages[fallbackKey];
            }
        }
        if (!importPage) {
            console.error(`Page not found: ./pages/${name}.tsx, falling back to DashboardPage`);
            importPage = pages['./pages/DashboardPage.tsx'];
        }

        let page;
        try {
            page = await importPage();
        } catch (err) {
            console.warn(`[Inertia Resolver] Dynamic import for ${name} failed offline, falling back to DashboardPage:`, err);
            try {
                page = await pages['./pages/DashboardPage.tsx']();
            } catch (fallbackErr) {
                console.error('[Inertia Resolver] Dashboard fallback failed:', fallbackErr);
            }
        }

        // If it has a default export
        if (page && page.default) {
            if (!name.startsWith('LoginPage') &&
                !name.startsWith('SignupPage') &&
                !name.startsWith('ResetPasswordPage') &&
                !name.startsWith('CustomerDisplayPage') &&
                !name.startsWith('admin/AdminLoginPage') &&
                !name.startsWith('NotFound') &&
                !page.default.layout) {

                page.default.layout = (pageElement) => <DesktopLayout>{pageElement}</DesktopLayout>;
            }
        }
        return page;
    },
    setup({ el, App, props }) {
        syncDocumentBranding();
        const root = createRoot(el);
        root.render(
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <TooltipProvider>
                        <AdminProvider>
                            <AppProvider>
                                <Toaster />
                                <Sonner />
                                <App {...props} />
                            </AppProvider>
                        </AdminProvider>
                    </TooltipProvider>
                </QueryClientProvider>
            </ErrorBoundary>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
