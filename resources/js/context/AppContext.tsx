import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api as apiClient } from '@/api';
import type { User as SupabaseUser, Session } from '@/api';
import type { Store, Item, Customer, Supplier, Expense, Sale, SaleItem, CustomerDebt, CashSession, CashMovement, Payment, Return, StockTransfer, CartItem, StaffAccount, Category } from '@/types';
import { getDeviceId } from '@/lib/device';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
}

interface LicenseInfo {
  status: string;
  expiry_date?: string;
  plan_name?: string;
  max_users?: number;
  max_devices?: number;
  max_stores?: number;
  days_remaining?: number;
  features?: Record<string, boolean>;
}

interface StoreFeatures {
  [key: string]: boolean;
}

interface AppState {
  session: Session | null;
  profile: Profile | null;
  currentStore: Store | null;
  stores: Store[];
  isAuthenticated: boolean;
  loading: boolean;
  items: Item[];
  customers: Customer[];
  suppliers: Supplier[];
  expenses: Expense[];
  sales: Sale[];
  saleItems: SaleItem[];
  customerDebts: CustomerDebt[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  payments: Payment[];
  returns: Return[];
  stockTransfers: StockTransfer[];
  cart: CartItem[];
  staffAccounts: StaffAccount[];
  licenseStatus: LicenseInfo | null;
  storeFeatures: StoreFeatures;
  categories: Category[];
}

interface AppContextType extends Omit<AppState, 'session'> {
  storeFeatures: StoreFeatures;
  user: { 
    id: string; 
    email: string; 
    full_name: string; 
    phone: string; 
    created_at: string;
    role?: 'owner' | 'admin' | 'cashier' | 'inventory_manager';
    assigned_store_id?: string | null;
  } | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<boolean>;
  setCurrentStore: (store: Store) => void;
  addItem: (item: Omit<Item, 'id' | 'created_at'>) => Promise<void>;
  addItemsBulk: (items: Omit<Item, 'id' | 'created_at'>[]) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at'>) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<void>;
  addToCart: (item: Item, qty: number) => void;
  removeFromCart: (itemId: string) => void;
  updateCartPrice: (itemId: string, newPrice: number) => void;
  clearCart: () => void;
  completeSale: (saleType: 'cash' | 'credit' | 'mixed', customerId: string | null, paidAmount: number, paymentMethod: string) => Promise<Sale | null>;
  recordPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>;
  recordReturn: (saleId: string, items: { item_id: string; sale_item_id: string; quantity: number; amount: number }[], refundMethod: string) => Promise<void>;
  addStore: (store: Omit<Store, 'id' | 'created_at'>) => Promise<Store | null>;
  deleteStore: (id: string) => Promise<boolean>;
  updateStore: (id: string, updates: Partial<Store>) => Promise<void>;
  addCashMovement: (movement: Omit<CashMovement, 'id' | 'created_at'>) => Promise<void>;
  addStaffAccount: (staff: Omit<StaffAccount, 'id' | 'created_at'> & { password?: string }) => Promise<void>;
  deleteStaffAccount: (id: string) => Promise<void>;
  updateStaffAccount: (id: string, updates: Partial<StaffAccount> & { password?: string }) => Promise<void>;
  updateProfile: (updates: { full_name?: string; phone?: string }) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  isLicenseActive: boolean;
  currency: string;
  formatCurrency: (amount: number | string) => string;
  addCategory: (category: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    session: null,
    profile: null,
    currentStore: null,
    stores: [],
    isAuthenticated: false,
    loading: true,
    items: [],
    customers: [],
    suppliers: [],
    expenses: [],
    sales: [],
    saleItems: [],
    customerDebts: [],
    cashSessions: [],
    cashMovements: [],
    payments: [],
    returns: [],
    stockTransfers: [],
    cart: [],
    staffAccounts: [],
    licenseStatus: null,
    storeFeatures: {},
    categories: [],
  });

  const currency = state.currentStore?.currency || 'KSh';
  const formatCurrency = useCallback((amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const validNum = isNaN(num) ? 0 : num;
    return `${currency} ${validNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currency]);

  // Derived: is the license active and not expired?
  const isLicenseActive = (() => {
    const ls = state.licenseStatus;
    if (!ls || ls.status === 'none') return true; // No license system = allow (first store / no stores)
    if (ls.status !== 'active') return false;
    if (ls.days_remaining !== undefined && ls.days_remaining <= 0) return false;
    return true;
  })();

  // Load all data for a store
  const loadStoreData = useCallback(async (storeId: string) => {
    try {
      const { data } = await apiClient.rpc('get_store_data', { _store_id: storeId });
      
      if (data) {
        setState(prev => ({
          ...prev,
          items: (data.items || []) as unknown as Item[],
          customers: (data.customers || []) as unknown as Customer[],
          suppliers: (data.suppliers || []) as unknown as Supplier[],
          expenses: (data.expenses || []) as unknown as Expense[],
          sales: (data.sales || []) as unknown as Sale[],
          saleItems: (data.saleItems || []) as unknown as SaleItem[],
          customerDebts: (data.customerDebts || []) as unknown as CustomerDebt[],
          payments: (data.payments || []) as unknown as Payment[],
          returns: (data.returns || []) as unknown as Return[],
          staffAccounts: (data.staffAccounts || []) as unknown as StaffAccount[],
          stockTransfers: (data.stockTransfers || []) as unknown as StockTransfer[],
          categories: (data.categories || []) as unknown as Category[],
        }));
      }
    } catch (e) {
      console.error('Failed to load store data:', e);
    }
  }, []);


  const loadUserData = useCallback(async (userId: string, session: Session) => {
    try {
      // Use the user data directly from the session instead of querying the backend and retrying
      const user = session.user as any;
      const profile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.name || '',
        name: user.name || '',
      };

      const role = user.role || 'owner';
      const assignedStoreId = user.assigned_store_id;

      let storesResponse;
      if (role === 'owner') {
        storesResponse = await apiClient.from('stores').select('*').eq('owner_user_id', userId);
      } else if (assignedStoreId) {
        storesResponse = await apiClient.from('stores').select('*').eq('id', assignedStoreId);
      } else {
        storesResponse = { data: [] };
      }
      
      const { data: stores } = storesResponse;

      const storeList = (stores || []) as unknown as Store[];
      const savedStoreId = localStorage.getItem('currentStoreId');
      const currentStore = storeList.find(s => s.id === savedStoreId) || storeList[0] || null;

      // Check license status (owner-level)
      let licenseStatus: LicenseInfo | null = null;
      let storeFeatures: StoreFeatures = {};
      if (currentStore) {
        try {
          const [{ data: licData }, { data: featData }] = await Promise.all([
            apiClient.rpc('check_store_license', { _store_id: currentStore.id }),
            apiClient.rpc('get_store_features', { _store_id: currentStore.id }),
          ]);
          if (licData && typeof licData === 'object') {
            licenseStatus = licData as unknown as LicenseInfo;
          }
          if (featData && typeof featData === 'object') {
            storeFeatures = featData as unknown as StoreFeatures;
          }
        } catch (e) {
          console.error('License check failed:', e);
        }
      }

      setState(prev => ({
        ...prev,
        session,
        profile: profile as unknown as Profile,
        stores: storeList,
        currentStore,
        isAuthenticated: true,
        loading: false,
        licenseStatus,
        storeFeatures,
      }));

      if (currentStore) {
        loadStoreData(currentStore.id);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setState(prev => ({ ...prev, loading: false, isAuthenticated: true, session }));
    }
  }, [loadStoreData]);

  // Auth state listener
  useEffect(() => {
    // Don't trigger heavy store data loading on admin routes
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    if (isAdminRoute) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    const { data: { subscription } } = apiClient.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setTimeout(() => {
          loadUserData(session.user.id, session);
        }, 0);
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          profile: null,
          currentStore: null,
          stores: [],
          isAuthenticated: false,
          loading: false,
          items: [], customers: [], suppliers: [], expenses: [],
          sales: [], saleItems: [], customerDebts: [], payments: [],
          returns: [], stockTransfers: [], staffAccounts: [],
          licenseStatus: null,
          storeFeatures: {},
          categories: [],
        }));
      }
    });

    apiClient.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState(prev => ({ ...prev, loading: false }));
      } else {
        setTimeout(() => {
          loadUserData(session.user.id, session);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const refreshData = useCallback(async () => {
    if (state.currentStore) {
      await loadStoreData(state.currentStore.id);
      // Also refresh license status
      try {
        const [{ data: licData }, { data: featData }] = await Promise.all([
          apiClient.rpc('check_store_license', { _store_id: state.currentStore.id }),
          apiClient.rpc('get_store_features', { _store_id: state.currentStore.id }),
        ]);
        setState(prev => ({
          ...prev,
          licenseStatus: licData ? (licData as unknown as LicenseInfo) : prev.licenseStatus,
          storeFeatures: featData ? (featData as unknown as StoreFeatures) : prev.storeFeatures,
        }));
      } catch (e) {
        console.error('License refresh failed:', e);
      }
    }
  }, [state.currentStore, loadStoreData]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await apiClient.auth.signInWithPassword({ email, password });
    return !error;
  }, []);

  const logout = useCallback(async () => {
    const userId = state.session?.user?.id;
    if (userId) {
      const deviceId = getDeviceId();
      await apiClient
        .from('device_sessions')
        .update({ status: 'logged_out' } as any)
        .eq('user_id', userId)
        .eq('device_id', deviceId);
    }
    await apiClient.auth.signOut();
  }, [state.session]);

  const signup = useCallback(async (email: string, password: string, name: string, phone: string) => {
    const { error } = await apiClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await apiClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return !error;
  }, []);

  const setCurrentStore = useCallback(async (store: Store) => {
    localStorage.setItem('currentStoreId', store.id);
    setState(prev => ({ ...prev, currentStore: store }));
    loadStoreData(store.id);
    
    // Refresh license for the new store context
    try {
      const [{ data: licData }, { data: featData }] = await Promise.all([
        apiClient.rpc('check_store_license', { _store_id: store.id }),
        apiClient.rpc('get_store_features', { _store_id: store.id }),
      ]);
      setState(prev => ({
        ...prev,
        licenseStatus: licData ? (licData as unknown as LicenseInfo) : prev.licenseStatus,
        storeFeatures: featData ? (featData as unknown as StoreFeatures) : prev.storeFeatures,
      }));
    } catch (e) {
      console.error('License check on store switch failed:', e);
    }
  }, [loadStoreData]);

  const addItem = useCallback(async (item: Omit<Item, 'id' | 'created_at'>) => {
    const { data, error } = await apiClient.from('items').insert(item as any).select().single();
    if (error) throw new Error(error.message || 'Failed to add item');
    if (data) {
      setState(prev => ({ ...prev, items: [...prev.items, data as unknown as Item] }));
    }
  }, []);

  const addItemsBulk = useCallback(async (newItems: Omit<Item, 'id' | 'created_at'>[]) => {
    const { data, error } = await apiClient.from('items').insert(newItems as any).select();
    if (error) throw new Error(error.message || 'Failed to add items bulk');
    if (data && Array.isArray(data)) {
      setState(prev => ({ ...prev, items: [...prev.items, ...(data as unknown as Item[])] }));
    }
  }, []);


  const updateItem = useCallback(async (id: string, updates: Partial<Item>) => {
    const { error } = await apiClient.from('items').update(updates as any).eq('id', id);
    if (!error) {
      setState(prev => ({
        ...prev,
        items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i),
      }));
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await apiClient.from('items').delete().eq('id', id);
    if (!error) {
      setState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
    }
  }, []);

  const addCategory = useCallback(async (category: Omit<Category, 'id' | 'created_at'>) => {
    const { data, error } = await apiClient.from('categories').insert(category as any).select().single();
    if (!error && data) {
      setState(prev => ({ ...prev, categories: [...prev.categories, data as unknown as Category] }));
    }
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const { error } = await apiClient.from('categories').update(updates as any).eq('id', id);
    if (!error) {
      setState(prev => ({
        ...prev,
        categories: prev.categories.map(c => c.id === id ? { ...c, ...updates } : c),
      }));
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await apiClient.from('categories').delete().eq('id', id);
    if (!error) {
      setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
    }
  }, []);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'created_at'>) => {
    const { data, error } = await apiClient.from('customers').insert(customer as any).select().single();
    if (!error && data) {
      setState(prev => ({ ...prev, customers: [...prev.customers, data as unknown as Customer] }));
    }
  }, []);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const { error } = await apiClient.from('customers').update(updates as any).eq('id', id);
    if (!error) {
      setState(prev => ({
        ...prev,
        customers: prev.customers.map(c => c.id === id ? { ...c, ...updates } : c),
      }));
    }
  }, []);

  const addSupplier = useCallback(async (supplier: Omit<Supplier, 'id' | 'created_at'>) => {
    const { data, error } = await apiClient.from('suppliers').insert(supplier as any).select().single();
    if (!error && data) {
      setState(prev => ({ ...prev, suppliers: [...prev.suppliers, data as unknown as Supplier] }));
    }
  }, []);

  const deleteSupplier = useCallback(async (id: string) => {
    const { error } = await apiClient.from('suppliers').delete().eq('id', id);
    if (!error) {
      setState(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
    }
  }, []);

  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'created_at'>) => {
    const { data, error } = await apiClient.from('expenses').insert(expense as any).select().single();
    if (!error && data) {
      setState(prev => ({ ...prev, expenses: [data as unknown as Expense, ...prev.expenses] }));
    }
  }, []);

  // Cart operations (local only)
  const addToCart = useCallback((item: Item, qty: number) => {
    setState(prev => {
      const existing = prev.cart.find(c => c.item.id === item.id);
      if (existing) {
        return {
          ...prev,
          cart: prev.cart.map(c => c.item.id === item.id
            ? { ...c, quantity: c.quantity + qty, line_total: (c.quantity + qty) * c.item.sell_price }
            : c
          ),
        };
      }
      return {
        ...prev,
        cart: [...prev.cart, { item, quantity: qty, line_total: qty * item.sell_price }],
      };
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setState(prev => {
      const existing = prev.cart.find(c => c.item.id === itemId);
      if (existing && existing.quantity > 1) {
        return {
          ...prev,
          cart: prev.cart.map(c => c.item.id === itemId
            ? { ...c, quantity: c.quantity - 1, line_total: (c.quantity - 1) * c.item.sell_price }
            : c
          ),
        };
      }
      return { ...prev, cart: prev.cart.filter(c => c.item.id !== itemId) };
    });
  }, []);

  const clearCart = useCallback(() => {
    setState(prev => ({ ...prev, cart: [] }));
  }, []);

  const updateCartPrice = useCallback((itemId: string, newPrice: number) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.map(c => c.item.id === itemId
        ? { ...c, item: { ...c.item, sell_price: newPrice }, line_total: c.quantity * newPrice }
        : c
      ),
    }));
  }, []);

  const completeSale = useCallback(async (saleType: 'cash' | 'credit' | 'mixed', customerId: string | null, paidAmount: number, paymentMethod: string) => {
    const subtotal = state.cart.reduce((sum, c) => sum + c.line_total, 0);
    if (subtotal === 0) return null;
    
    const storeTaxRate = state.currentStore?.tax_enabled ? (state.currentStore.tax_rate || 0) : 0;
    const tax = subtotal * (storeTaxRate / 100);
    const total = subtotal + tax; // Discount is currently 0 in StartSalePage

    const outstanding = total - paidAmount;
    const receiptNo = `RCP-${Date.now()}`;
    const userId = state.session?.user?.id || '';
    const storeId = state.currentStore?.id || '';

    const { data: saleData, error: saleError } = await apiClient.from('sales').insert({
      store_id: storeId,
      receipt_no: receiptNo,
      customer_id: customerId,
      staff_user_id: userId,
      sale_type: saleType,
      subtotal,
      discount: 0,
      tax,
      tax_rate: storeTaxRate,
      total,
      paid_amount: paidAmount,
      outstanding_amount: outstanding,
      status: 'completed',
    } as any).select().single();

    if (saleError || !saleData) return null;
    const sale = saleData as unknown as Sale;

    const saleItemsData = state.cart.map(c => ({
      sale_id: saleData.id,
      item_id: c.item.id,
      item_name: c.item.name,
      quantity: c.quantity,
      cost_price: c.item.cost_price,
      sell_price: c.item.sell_price,
      line_total: c.line_total,
    }));
    await apiClient.from('sale_items').insert(saleItemsData as any);

    for (const c of state.cart) {
      if (c.item.type === 'product') {
        await apiClient.from('items').update({ quantity: Math.max(0, c.item.quantity - c.quantity) } as any).eq('id', c.item.id);
      }
    }

    await apiClient.from('payments').insert({
      store_id: storeId,
      sale_id: sale.id,
      customer_id: customerId,
      payment_type: 'sale',
      direction: 'in',
      method: paymentMethod,
      amount: paidAmount,
      reference: receiptNo,
      created_by: userId,
    } as any);

    if (outstanding > 0 && customerId) {
      const customer = state.customers.find(c => c.id === customerId);
      await apiClient.from('customer_debts').insert({
        store_id: storeId,
        customer_id: customerId,
        customer_name: customer?.name || '',
        sale_id: sale.id,
        original_amount: outstanding,
        balance_amount: outstanding,
        status: 'open',
      } as any);
    }

    setState(prev => ({ ...prev, cart: [] }));
    await loadStoreData(storeId);

    return sale;
  }, [state.cart, state.currentStore, state.session, state.customers, loadStoreData]);

  const recordPayment = useCallback(async (payment: Omit<Payment, 'id' | 'created_at'>) => {
    await apiClient.from('payments').insert(payment as any);
    if (payment.customer_id && payment.direction === 'in') {
      const { data: debts } = await apiClient
        .from('customer_debts')
        .select('*')
        .eq('customer_id', payment.customer_id)
        .neq('status', 'paid');

      let remaining = payment.amount;
      for (const debt of (debts || []) as any[]) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, debt.balance_amount);
        const newBalance = debt.balance_amount - deduction;
        await apiClient.from('customer_debts').update({
          balance_amount: newBalance,
          status: newBalance === 0 ? 'paid' : 'partial',
        } as any).eq('id', debt.id);
        remaining -= deduction;
      }
    }
    if (state.currentStore) await loadStoreData(state.currentStore.id);
  }, [state.currentStore, loadStoreData]);

  const getCsrfToken = () => {
    const name = 'XSRF-TOKEN=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') { c = c.substring(1); }
      if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return '';
  };

  const recordReturn = useCallback(async (saleId: string, items: { item_id: string; sale_item_id: string; quantity: number; amount: number }[], refundMethod: string) => {
    const storeId = state.currentStore?.id || '';
    
    try {
      const res = await fetch('/api/rest/v1/process-return', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': getCsrfToken()
        },
        body: JSON.stringify({
          saleId,
          items,
          refundMethod,
          storeId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to process return');
      }
    } catch (e: any) {
      console.error(e);
      throw e;
    }

    if (state.currentStore) await loadStoreData(state.currentStore.id);
  }, [state.currentStore, loadStoreData]);

  const addStore = useCallback(async (store: Omit<Store, 'id' | 'created_at'>): Promise<Store | null> => {
    const userId = state.session?.user?.id;
    if (!userId) {
      console.error('addStore: No authenticated user');
      return null;
    }

    // Server-side check
    const { data: check } = await apiClient.rpc('check_store_creation_allowed', { _user_id: userId });
    const checkResult = check as any;
    if (checkResult && !checkResult.allowed) {
      throw new Error(checkResult.reason);
    }

      const storeWithOwner = { ...store, owner_user_id: userId };
    
    const { data, error } = await apiClient.from('stores').insert(storeWithOwner as any).select().single();
    if (error) {
      console.error('addStore error:', error);
      return null;
    }
    if (data) {
      const newStore = data as unknown as Store;
      
      // Owner-level license linking for additional stores
      if (state.stores.length > 0) {
        const { data: inheritResult, error: inheritError } = await apiClient.rpc('inherit_owner_license', {
          _new_store_id: newStore.id,
          _owner_id: userId,
        });

        if (inheritError) {
          console.error('License inheritance error:', inheritError);
          await apiClient.from('stores').delete().eq('id', newStore.id);
          throw new Error('Failed to link new store to owner license. Store creation cancelled.');
        }

        const inheritPayload = inheritResult as { inherited?: boolean; reason?: string } | null;
        if (!inheritPayload?.inherited) {
          await apiClient.from('stores').delete().eq('id', newStore.id);
          throw new Error(inheritPayload?.reason || 'Owner has no valid license context for additional stores.');
        }
      }

      localStorage.setItem('currentStoreId', newStore.id);
      
      // Refresh license status for the new store
      let licenseStatus = state.licenseStatus;
      let storeFeatures = state.storeFeatures;
      try {
        const [{ data: licData }, { data: featData }] = await Promise.all([
          apiClient.rpc('check_store_license', { _store_id: newStore.id }),
          apiClient.rpc('get_store_features', { _store_id: newStore.id }),
        ]);
        if (licData && typeof licData === 'object') {
          licenseStatus = licData as unknown as LicenseInfo;
        }
        if (featData && typeof featData === 'object') {
          storeFeatures = featData as unknown as StoreFeatures;
        }
      } catch (e) {
        console.error('License refresh after store creation failed:', e);
      }
      
      setState(prev => ({ 
        ...prev, 
        stores: [...prev.stores, newStore], 
        currentStore: newStore,
        licenseStatus,
        storeFeatures,
      }));
      return newStore;
    }
    return null;
  }, [state.session, state.stores]);

  const deleteStore = useCallback(async (id: string): Promise<boolean> => {
    const userId = state.session?.user?.id;
    if (!userId) return false;
    
    const storeToDelete = state.stores.find(s => s.id === id);
    if (!storeToDelete || storeToDelete.owner_user_id !== userId) {
      console.error('Cannot delete: not the owner');
      return false;
    }

    // Delete stock_transfer_items for transfers involving this store
    const { data: transfers } = await apiClient
      .from('stock_transfers')
      .select('id')
      .or(`source_store_id.eq.${id},destination_store_id.eq.${id}`);
    
    if (transfers && transfers.length > 0) {
      const transferIds = transfers.map(t => t.id);
      await apiClient.from('stock_transfer_items').delete().in('stock_transfer_id', transferIds);
      await apiClient.from('stock_transfers').delete().or(`source_store_id.eq.${id},destination_store_id.eq.${id}`);
    }

    const { data: salesData } = await apiClient.from('sales').select('id').eq('store_id', id);
    if (salesData && salesData.length > 0) {
      const saleIds = salesData.map(s => s.id);
      await apiClient.from('sale_items').delete().in('sale_id', saleIds);
      
      const { data: returnsData } = await apiClient.from('returns').select('id').eq('store_id', id);
      if (returnsData && returnsData.length > 0) {
        await apiClient.from('return_items').delete().in('return_id', returnsData.map(r => r.id));
      }
    }

    const directTables = [
      'cash_movements', 'customer_debts', 'payments', 'returns', 'sales',
      'expenses', 'items', 'customers', 'suppliers', 'staff_accounts',
      'payment_accounts', 'cash_sessions', 'licenses', 'subscriptions',
      'payment_integrations', 'support_tickets', 'payment_sessions',
      'license_extensions', 'license_extension_logs', 'platform_payments'
    ];
    
    for (const table of directTables) {
      await (apiClient.from(table as any).delete() as any).eq('store_id', id);
    }

    const { error } = await apiClient.from('stores').delete().eq('id', id);
    if (error) {
      console.error('deleteStore error:', error);
      return false;
    }

    setState(prev => {
      const newStores = prev.stores.filter(s => s.id !== id);
      const newCurrentStore = prev.currentStore?.id === id ? (newStores[0] || null) : prev.currentStore;
      if (newCurrentStore) {
        localStorage.setItem('currentStoreId', newCurrentStore.id);
      } else {
        localStorage.removeItem('currentStoreId');
      }
      return { ...prev, stores: newStores, currentStore: newCurrentStore };
    });
    return true;
  }, [state.session, state.stores]);

  const updateStore = useCallback(async (id: string, updates: Partial<Store>) => {
    const { error } = await apiClient.from('stores').update(updates as any).eq('id', id);
    if (!error) {
      setState(prev => ({
        ...prev,
        stores: prev.stores.map(s => s.id === id ? { ...s, ...updates } : s),
        currentStore: prev.currentStore?.id === id ? { ...prev.currentStore, ...updates } : prev.currentStore,
      }));
    }
  }, []);

  const addCashMovement = useCallback(async (movement: Omit<CashMovement, 'id' | 'created_at'>) => {
    await apiClient.from('cash_movements').insert(movement as any);
    if (state.currentStore) await loadStoreData(state.currentStore.id);
  }, [state.currentStore, loadStoreData]);

  const addStaffAccount = useCallback(async (staff: Omit<StaffAccount, 'id' | 'created_at'> & { password?: string }) => {
    // Check user limit server-side before adding
    if (staff.store_id) {
      const { data: userCheck } = await apiClient.rpc('check_user_limit', { _store_id: staff.store_id });
      const result = userCheck as any;
      if (result && !result.allowed) {
        throw new Error(result.reason);
      }
    }
    
    const token = localStorage.getItem('access_token');
    const res = await fetch('/api/auth/v1/create-staff', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': getCsrfToken()
      },
      body: JSON.stringify(staff)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || err.error || 'Failed to create staff account');
    }
    const { staff: newStaff } = await res.json();
    setState(prev => ({ ...prev, staffAccounts: [...prev.staffAccounts, newStaff as StaffAccount] }));
  }, []);

  const updateProfile = useCallback(async (updates: { full_name?: string; phone?: string }) => {
    const userId = state.session?.user?.id;
    if (!userId) return false;
    const { error } = await apiClient.from('profiles').update(updates as any).eq('id', userId);
    if (!error) {
      setState(prev => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, ...updates } : prev.profile,
      }));
      return true;
    }
    return false;
  }, [state.session]);

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await apiClient.auth.updateUser({ password: newPassword });
    return !error;
  }, []);

  const deleteStaffAccount = useCallback(async (id: string) => {
    const { error } = await apiClient.from('staff_accounts').delete().eq('id', id);
    if (!error) {
      setState(prev => ({ ...prev, staffAccounts: prev.staffAccounts.filter(s => s.id !== id) }));
    }
  }, []);

  const updateStaffAccount = useCallback(async (id: string, updates: Partial<StaffAccount> & { password?: string }) => {
    const { password, ...staffUpdates } = updates;
    const { error } = await apiClient.from('staff_accounts').update(staffUpdates as any).eq('id', id);
    if (!error) {
      if (password) {
        await fetch('/api/auth/v1/update-staff-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': getCsrfToken()
          },
          body: JSON.stringify({ staff_id: id, password })
        });
      }
      setState(prev => ({
        ...prev,
        staffAccounts: prev.staffAccounts.map(s => s.id === id ? { ...s, ...staffUpdates } : s),
      }));
    }
  }, []);

  const user = state.profile ? {
    id: state.profile.id,
    email: state.profile.email,
    full_name: state.profile.full_name,
    phone: state.profile.phone,
    created_at: '',
    role: (state.session?.user as any)?.role,
    assigned_store_id: (state.session?.user as any)?.assigned_store_id,
  } : null;

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      profile: state.profile,
      currentStore: state.currentStore,
      stores: state.stores,
      isAuthenticated: state.isAuthenticated,
      loading: state.loading,
      items: state.items,
      customers: state.customers,
      suppliers: state.suppliers,
      expenses: state.expenses,
      sales: state.sales,
      saleItems: state.saleItems,
      customerDebts: state.customerDebts,
      cashSessions: state.cashSessions,
      cashMovements: state.cashMovements,
      payments: state.payments,
      returns: state.returns,
      stockTransfers: state.stockTransfers,
      cart: state.cart,
      staffAccounts: state.staffAccounts,
      licenseStatus: state.licenseStatus,
      storeFeatures: state.storeFeatures,
      categories: state.categories,
      user,
      login, logout, signup, resetPassword, setCurrentStore,
      addItem, addItemsBulk, updateItem, deleteItem,
      addCustomer, updateCustomer, addSupplier, deleteSupplier,
      addExpense, addToCart, removeFromCart, updateCartPrice, clearCart,
      completeSale, recordPayment, recordReturn,
      addStore, deleteStore, updateStore, addCashMovement,
      addStaffAccount, deleteStaffAccount, updateStaffAccount,
      updateProfile, changePassword,
      refreshData,
      isLicenseActive,
      currency, formatCurrency,
      addCategory, updateCategory, deleteCategory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
