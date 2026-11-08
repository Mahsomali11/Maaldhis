import './index.css';

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppProvider } from '@/context/AppContext';
import { AdminProvider } from '@/context/AdminContext';
import DesktopLayout from '@/components/DesktopLayout';
import { initSubmitGuard } from '@/lib/submit-guard';
import { getPlatformName, syncDocumentBranding } from '@/hooks/usePlatformName';

// Initialize global double-click & duplicate submission guard
initSubmitGuard();

// Register PWA Service Worker for seamless offline caching & refresh support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'PRECACHE_ROUTES',
                        routes: [
                            '/dashboard',
                            '/start-sale',
                            '/inventory',
                            '/patients',
                            '/dental-billing',
                            '/dental-charting',
                            '/dental-catalog',
                            '/sales-report',
                            '/expenses'
                        ],
                    });
                }
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

const ROUTE_PAGE_MAP = {
    '/dashboard': 'DashboardPage',
    '/start-sale': 'StartSalePage',
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
};

if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (initialPageData) {
        // If an offline reload served the base App Shell whose URL doesn't match current route
        if (ROUTE_PAGE_MAP[currentPath] && initialPageData.url !== currentPath) {
            initialPageData.component = ROUTE_PAGE_MAP[currentPath];
            initialPageData.url = currentPath;
        }
    } else {
        // Fallback if data-page attribute is missing
        const matchedComp = ROUTE_PAGE_MAP[currentPath] || 'DashboardPage';
        let cachedUser = null;
        let cachedStores = [];
        try {
            const u = localStorage.getItem('cached_auth_user');
            if (u) cachedUser = JSON.parse(u);
            const s = localStorage.getItem('cached_stores');
            if (s) cachedStores = JSON.parse(s);
        } catch (_) {}

        initialPageData = {
            component: matchedComp,
            props: {
                auth: { user: cachedUser },
                initialStores: cachedStores,
                isOfflineFallback: true,
            },
            url: currentPath,
            version: '',
        };
    }
}

const pages = import.meta.glob('./pages/**/*.tsx');

createInertiaApp({
    title: (title) => title ? `${title} - ${getPlatformName()}` : getPlatformName(),
    page: initialPageData,
    resolve: async (name) => {
        const importPage = pages[`./pages/${name}.tsx`];
        if (!importPage) {
            console.error(`Page not found: ./pages/${name}.tsx`);
            return;
        }

        const page = await importPage();

        // If it has a default export
        if (page.default) {
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
        );
    },
    progress: {
        color: '#4B5563',
    },
});
