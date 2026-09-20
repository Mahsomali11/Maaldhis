// Feature keys that map to plan features_enabled JSONB
export const FEATURE_KEYS = {
  pos_sales: 'pos_sales',
  inventory: 'inventory',
  customers: 'customers',
  credit_sales: 'credit_sales',
  expenses: 'expenses',
  cash_flow: 'cash_flow',
  staff_accounts: 'staff_accounts',
  advanced_reports: 'advanced_reports',
  multi_store: 'multi_store',
  api_integrations: 'api_integrations',
  payment_integrations: 'payment_integrations',
  stock_transfers: 'stock_transfers',
  suppliers: 'suppliers',
  returns: 'returns',
  receipt_history: 'receipt_history',
  stock_report: 'stock_report',
} as const;

export type FeatureKey = keyof typeof FEATURE_KEYS;

// All available features with display labels
export const ALL_FEATURES: { key: FeatureKey; label: string }[] = [
  { key: 'pos_sales', label: 'POS Sales' },
  { key: 'inventory', label: 'Inventory Management' },
  { key: 'customers', label: 'Customer Management' },
  { key: 'credit_sales', label: 'Credit Sales' },
  { key: 'expenses', label: 'Expense Tracking' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'staff_accounts', label: 'Staff Accounts' },
  { key: 'advanced_reports', label: 'Advanced Reports' },
  { key: 'multi_store', label: 'Multi-Store Support' },
  { key: 'api_integrations', label: 'API Integrations' },
  { key: 'payment_integrations', label: 'Payment Integrations' },
  { key: 'stock_transfers', label: 'Stock Transfers' },
  { key: 'suppliers', label: 'Supplier Management' },
  { key: 'returns', label: 'Returns' },
  { key: 'receipt_history', label: 'Receipt History' },
  { key: 'stock_report', label: 'Stock Report' },
];

// Map routes to feature keys
export const ROUTE_FEATURE_MAP: Record<string, FeatureKey> = {
  '/start-sale': 'pos_sales',
  '/inventory': 'inventory',
  '/categories': 'inventory',
  '/customers': 'customers',
  '/credit-record': 'credit_sales',
  '/expenses': 'expenses',
  '/cash-flow': 'cash_flow',
  '/staff-accounts': 'staff_accounts',
  '/sales-report': 'advanced_reports',
  '/stock-transfers': 'stock_transfers',
  '/suppliers': 'suppliers',
  '/returns': 'returns',
  '/receipt-history': 'receipt_history',
  '/stock-report': 'stock_report',
  '/payment-accounts': 'payment_integrations',
};
