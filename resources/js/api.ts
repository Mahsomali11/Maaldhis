import {
  cacheRecord,
  cacheRecords,
  getCachedRecords,
  getCachedRecord,
  removeCachedRecord,
  enqueueSyncItem,
} from '@/lib/offline/indexedDb';
import { syncManager } from '@/lib/offline/syncManager';

export interface User {
  id: string;
  email?: string;
  [key: string]: any;
}

export interface Session {
  access_token: string;
  user: User;
}

const API_URL = '/api';

const getCsrfToken = () => {
  const name = 'XSRF-TOKEN=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
};

const inFlightRequests = new Map<string, Promise<any>>();

export function generateIdempotencyKey(payloadStr: string): string {
  let hash = 0;
  for (let i = 0; i < payloadStr.length; i++) {
    hash = ((hash << 5) - hash) + payloadStr.charCodeAt(i);
    hash |= 0;
  }
  return `idemp_${Date.now()}_${Math.abs(hash)}`;
}

const getHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
  const csrf = getCsrfToken();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
    ...(extraHeaders || {})
  };
};

function filterCachedRecords(records: any[], query: Record<string, string>): any[] {
  let result = [...records];

  for (const [key, val] of Object.entries(query)) {
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'count' || key === 'head') continue;

    if (val.startsWith('eq.')) {
      const target = val.slice(3);
      result = result.filter(r => {
        const itemVal = r[key];
        if (typeof itemVal === 'boolean') {
          return String(itemVal) === target.toLowerCase();
        }
        return String(itemVal ?? '') === target;
      });
    } else if (val.startsWith('neq.')) {
      const target = val.slice(4);
      result = result.filter(r => String(r[key] ?? '') !== target);
    } else if (val.startsWith('in.')) {
      const list = val.slice(4, -1).split(',');
      result = result.filter(r => list.includes(String(r[key] ?? '')));
    }
  }

  // Handle order
  if (query.order) {
    const [col, dir] = query.order.split('.');
    const isAsc = dir !== 'desc';
    result.sort((a, b) => {
      const valA = a[col] ?? '';
      const valB = b[col] ?? '';
      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });
  }

  // Handle limit
  if (query.limit) {
    const lim = parseInt(query.limit, 10);
    if (!isNaN(lim) && lim > 0) {
      result = result.slice(0, lim);
    }
  }

  return result;
}

class QueryBuilder {
  private table: string;
  private query: Record<string, string> = {};
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private isSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  private getIdFromQueryOrPayload(): string | null {
    if (this.query.id && this.query.id.startsWith('eq.')) {
      return this.query.id.slice(3);
    }
    if (this.payload && typeof this.payload === 'object' && this.payload.id) {
      return String(this.payload.id);
    }
    return null;
  }

  private async handleOfflineMutation(method: string, url: string): Promise<any> {
    const isSingle = this.isSingle;

    if (this.action === 'insert') {
      const records = Array.isArray(this.payload) ? this.payload : [this.payload];
      const preparedList = records.map(item => {
        const copy = { ...item };
        if (!copy.id) {
          copy.id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
        if (!copy.created_at) copy.created_at = new Date().toISOString();
        if (!copy.updated_at) copy.updated_at = new Date().toISOString();
        return copy;
      });

      // Save to IndexedDB immediately so UI displays it right away
      await cacheRecords(this.table, preparedList);

      // Enqueue to sync queue
      for (const item of preparedList) {
        await enqueueSyncItem({
          store_id: item.store_id,
          table: this.table,
          action: 'insert',
          url,
          method: 'POST',
          payload: item,
        });
      }

      window.dispatchEvent(new CustomEvent('action-complete'));
      return {
        data: isSingle ? preparedList[0] : (Array.isArray(this.payload) ? preparedList : preparedList[0]),
        count: preparedList.length,
        error: null,
      };
    }

    if (this.action === 'update') {
      const id = this.getIdFromQueryOrPayload();
      if (id) {
        const existing = await getCachedRecord(this.table, id);
        const merged = { ...(existing || {}), ...this.payload, updated_at: new Date().toISOString() };
        await cacheRecord(this.table, merged);
      }

      await enqueueSyncItem({
        store_id: this.payload?.store_id,
        table: this.table,
        action: 'update',
        url,
        method: 'PATCH',
        payload: this.payload,
      });

      window.dispatchEvent(new CustomEvent('action-complete'));
      return { data: this.payload, count: 1, error: null };
    }

    if (this.action === 'delete') {
      const id = this.getIdFromQueryOrPayload();
      if (id) {
        await removeCachedRecord(this.table, id);
      }

      await enqueueSyncItem({
        table: this.table,
        action: 'delete',
        url,
        method: 'DELETE',
      });

      window.dispatchEvent(new CustomEvent('action-complete'));
      return { data: null, count: 1, error: null };
    }

    return { data: null, count: 0, error: null };
  }

  private async handleOfflineFallback(method: string, url: string): Promise<any> {
    if (this.action === 'select') {
      const storeId = this.query.store_id?.startsWith('eq.') ? this.query.store_id.slice(3) : undefined;
      const cached = await getCachedRecords(this.table, storeId);
      const filtered = filterCachedRecords(cached, this.query);
      const data = this.isSingle ? (filtered[0] || null) : filtered;
      return { data, count: filtered.length, error: null };
    }

    return this.handleOfflineMutation(method, url);
  }

  select(fields = '*', options?: { count?: string; head?: boolean }) {
    if (this.action !== 'insert' && this.action !== 'update') {
      this.action = 'select';
    }
    this.query.select = fields;
    if (options?.count) {
      this.query.count = options.count;
    }
    if (options?.head) {
      this.query.head = 'true';
    }
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.query[column] = `eq.${value}`;
    return this;
  }

  neq(column: string, value: any) {
    this.query[column] = `neq.${value}`;
    return this;
  }

  in(column: string, values: any[]) {
    this.query[column] = `in.(${values.join(',')})`;
    return this;
  }

  or(filter: string) {
    this.query['or'] = filter;
    return this;
  }

  order(column: string, options: { ascending?: boolean } = { ascending: true }) {
    this.query.order = `${column}.${options.ascending ? 'asc' : 'desc'}`;
    return this;
  }

  single() {
    this.isSingle = true;
    this.query.limit = '1';
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    this.query.limit = '1';
    return this;
  }

  limit(count: number) {
    this.query.limit = count.toString();
    return this;
  }

  async then(resolve: any, reject: any) {
    const q = new URLSearchParams(this.query).toString();
    const url = `${API_URL}/rest/v1/${this.table}${q ? '?' + q : ''}`;

    let method = 'GET';
    if (this.action === 'insert') method = 'POST';
    if (this.action === 'update') method = 'PATCH';
    if (this.action === 'delete') method = 'DELETE';

    const isMutating = method === 'POST' || method === 'PATCH';
    const payloadStr = this.payload ? JSON.stringify(this.payload) : '';
    const requestKey = `${method}:${url}:${payloadStr}`;

    // Return in-flight promise if an identical mutating request is already executing
    if (isMutating && inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey)!.then(resolve, reject);
    }

    const executeRequest = async () => {
      const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      // Handle offline mode immediately if offline
      if (isBrowserOffline) {
        if (this.action !== 'select') {
          return this.handleOfflineMutation(method, url);
        } else {
          return this.handleOfflineFallback(method, url);
        }
      }

      try {
        const extraHeaders: Record<string, string> = {};
        if (isMutating) {
          extraHeaders['X-Idempotency-Key'] = generateIdempotencyKey(requestKey);
        }

        const res = await fetch(url, {
          method,
          credentials: 'same-origin',
          headers: getHeaders(extraHeaders),
          body: this.payload ? JSON.stringify(this.payload) : undefined
        });

        if (res.status === 401 || res.status === 419) {
          // Force a reload to trigger Inertia redirect to login if session expires
          window.location.reload();
          return { data: null, error: new Error('Session expired') };
        }

        if (!res.ok) {
          let errMsg = `HTTP error ${res.status}`;
          try {
            const errBody = await res.json();
            errMsg = errBody.message || errBody.error || errMsg;
          } catch (_) { }
          throw new Error(errMsg);
        }

        let data = null;
        let count = null;

        if (res.status !== 204) {
          data = await res.json();
        }

        const contentRange = res.headers.get('Content-Range');
        if (contentRange) {
          const parts = contentRange.split('/');
          if (parts.length > 1) {
            count = parseInt(parts[1], 10);
          }
        }

        if (this.isSingle && Array.isArray(data)) {
          data = data[0] || null;
        }

        if (method !== 'GET' && ['licenses', 'subscriptions', 'plans', 'stores'].includes(this.table)) {
          storeLicenseRpcCache.clear();
        }

        // Cache fresh records to IndexedDB for offline availability
        if (method === 'GET' && Array.isArray(data)) {
          cacheRecords(this.table, data).catch(() => {});
        } else if (method === 'POST' && data) {
          if (Array.isArray(data)) {
            cacheRecords(this.table, data).catch(() => {});
          } else {
            cacheRecord(this.table, data).catch(() => {});
          }
        } else if (method === 'PATCH' && this.payload) {
          const id = this.getIdFromQueryOrPayload();
          if (id) {
            getCachedRecord(this.table, id).then(existing => {
              cacheRecord(this.table, { ...(existing || {}), ...this.payload }).catch(() => {});
            }).catch(() => {});
          }
        } else if (method === 'DELETE') {
          const id = this.getIdFromQueryOrPayload();
          if (id) {
            removeCachedRecord(this.table, id).catch(() => {});
          }
        }

        const result = { data, count, error: null };
        window.dispatchEvent(new CustomEvent('action-complete'));
        return result;
      } catch (error: any) {
        // Fallback to offline storage if network drops or request fails due to connection
        const isNetworkFailure =
          isBrowserOffline ||
          !navigator.onLine ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError') ||
          error?.message?.includes('network error') ||
          error?.name === 'AbortError';

        if (isNetworkFailure) {
          console.warn(`[Offline Mode] Network request failed for ${method} ${url}. Switching to local persistence.`);
          return this.handleOfflineFallback(method, url);
        }

        window.dispatchEvent(new CustomEvent('action-error', { detail: error }));
        return { data: null, error };
      } finally {
        setTimeout(() => {
          inFlightRequests.delete(requestKey);
        }, 1500);
      }
    };

    const promise = executeRequest();
    if (isMutating) {
      inFlightRequests.set(requestKey, promise);
    }

    return promise.then(resolve, reject);
  }
}

class LaravelAuthMock {
  private listeners: ((event: string, session: any) => void)[] = [];

  private trigger(event: string, session: any) {
    this.listeners.forEach(l => l(event, session));
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(l => l !== callback);
          }
        }
      }
    };
  }

  private sessionCache: { session: Session | null; expiresAt: number } | null = null;

  async getSession() {
    if (this.sessionCache && this.sessionCache.expiresAt > Date.now()) {
      return { data: { session: this.sessionCache.session }, error: null };
    }

    // Check Inertia initial page props first to avoid a round-trip network request on initial mount
    if (typeof document !== 'undefined') {
      try {
        const appEl = document.getElementById('app');
        const dataPage = appEl?.getAttribute('data-page');
        if (dataPage) {
          const parsed = JSON.parse(dataPage);
          const user = parsed?.props?.auth?.user;
          if (user && user.id) {
            const session: Session = { access_token: 'session', user };
            this.sessionCache = { session, expiresAt: Date.now() + 15000 };
            try { localStorage.setItem('cached_auth_user', JSON.stringify(user)); } catch (_) {}
            return { data: { session }, error: null };
          }
        }
      } catch (e) { }
    }

    // Check localStorage cached auth user if offline or network drops
    if (typeof localStorage !== 'undefined') {
      try {
        const cachedUserStr = localStorage.getItem('cached_auth_user');
        if (cachedUserStr) {
          const user = JSON.parse(cachedUserStr);
          if (user && user.id) {
            const session: Session = { access_token: 'session', user };
            return { data: { session }, error: null };
          }
        }
      } catch (_) {}
    }

    try {
      const res = await fetch(`${API_URL}/user`, {
        headers: getHeaders(),
        credentials: 'same-origin'
      });
      if (res.ok) {
        const user = await res.json();
        const session: Session = { access_token: 'session', user };
        this.sessionCache = { session, expiresAt: Date.now() + 15000 };
        try { localStorage.setItem('cached_auth_user', JSON.stringify(user)); } catch (_) {}
        return { data: { session }, error: null };
      }
    } catch (e) { }

    return { data: { session: null }, error: null };
  }

  async signInWithPassword({ email, password }: any) {
    // The actual login happens via Inertia post('/login'), this is just a fallback 
    // in case unmigrated components call this directly.
    return { error: { message: 'Use standard login form' } };
  }

  async signUp({ email, password, options }: any) {
    return { error: { message: 'Use standard signup form' } };
  }

  async getUser() {
    const sessionRes = await this.getSession();
    if (sessionRes.data?.session?.user) {
      return { data: { user: sessionRes.data.session.user }, error: null };
    }
    return { data: { user: null }, error: null };
  }

  async signOut() {
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'same-origin'
      });
      // Force reload to trigger redirect
      window.location.href = '/login';
    } catch (e) { }
    this.trigger('SIGNED_OUT', null);
    return { error: null };
  }

  async updateUser(updates: any) {
    return { data: null, error: null };
  }

  async resetPasswordForEmail(email: string, options: any) {
    try {
      const res = await fetch('/forgot-password', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset link');
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async resetPassword(payload: any) {
    try {
      const res = await fetch('/reset-password', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({
          email: payload.email,
          token: payload.token,
          password: payload.password,
          password_confirmation: payload.password // Laravel requires confirmation
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

const storeLicenseRpcCache = new Map<string, { promise: Promise<{ status: any; features: any }>; expiresAt: number }>();

async function fetchStoreLicenseCombined(storeId: string): Promise<{ status: any; features: any }> {
  const cached = storeLicenseRpcCache.get(storeId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${API_URL}/rest/v1/rpc/get_store_license`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ _store_id: storeId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status) {
          const result = {
            status: data.status,
            features: data.features || {},
          };
          try { localStorage.setItem(`cached_license_${storeId}`, JSON.stringify(result)); } catch (_) {}
          return result;
        }
      }
    } catch (e) { }

    // Fallback to direct store/license lookup if needed
    try {
      const storeRes = await fetch(`${API_URL}/rest/v1/stores?id=eq.${storeId}`, { headers: getHeaders(), credentials: 'same-origin' });
      const storeData = await storeRes.json();
      if (storeData && storeData.length > 0) {
        const ownerId = storeData[0].owner_user_id;
        let licRes = await fetch(`${API_URL}/rest/v1/licenses?owner_user_id=eq.${ownerId}&status=eq.active&order=expiry_date.desc&select=*,plans(name)`, { headers: getHeaders(), credentials: 'same-origin' });
        let licData = await licRes.json();
        if (!licData || licData.length === 0) {
          licRes = await fetch(`${API_URL}/rest/v1/licenses?owner_user_id=eq.${ownerId}&order=created_at.desc&limit=1&select=*,plans(name)`, { headers: getHeaders(), credentials: 'same-origin' });
          licData = await licRes.json();
        }
        if (licData && licData.length > 0) {
          const lic = licData[0];
          let remaining = 999;
          const expiryTimestamp = lic.expiry_date || lic.expires_at;
          if (expiryTimestamp) {
            const clean = String(expiryTimestamp).split('T')[0].split(' ')[0];
            const parts = clean.split('-').map(Number);
            const expiryMs = parts.length === 3 && !parts.some(isNaN)
              ? new Date(parts[0], parts[1] - 1, parts[2]).getTime()
              : new Date(expiryTimestamp).getTime();
            const diffDays = Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
            remaining = diffDays === 0 ? 0 : diffDays;
          }
          const rawStatus = String(lic.status || '').toLowerCase();
          const effectiveStatus = (rawStatus === 'suspended' || rawStatus === 'cancelled' || rawStatus === 'canceled')
            ? rawStatus
            : (remaining >= 0 ? 'active' : 'expired');
          const features = typeof lic.features_enabled === 'string' ? JSON.parse(lic.features_enabled) : (lic.features_enabled || {});
          const result = {
            status: {
              status: effectiveStatus,
              plan_name: lic.plans?.name || 'Unknown',
              days_remaining: remaining,
              expiry_date: expiryTimestamp,
            },
            features,
          };
          try { localStorage.setItem(`cached_license_${storeId}`, JSON.stringify(result)); } catch (_) {}
          return result;
        }
      }
    } catch (e) { }

    // Offline resilience: Check cached license in localStorage first
    try {
      const cached = localStorage.getItem(`cached_license_${storeId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {}

    return {
      status: { status: 'active', plan_name: 'Offline Active', days_remaining: 999 },
      features: {},
    };
  })();

  storeLicenseRpcCache.set(storeId, { promise, expiresAt: Date.now() + 10000 });
  return promise;
}

export const api = {
  auth: new LaravelAuthMock(),
  from: (table: string) => new QueryBuilder(table),
  rpc: async (fn: string, params: any) => {
    // Mock RPC calls
    if (fn === 'check_store_creation_allowed') {
      return { data: { allowed: true } };
    }
    if (fn === 'inherit_owner_license') {
      return { data: { inherited: true } };
    }
    if (fn === 'check_store_license') {
      const combined = await fetchStoreLicenseCombined(params._store_id);
      return { data: combined.status };
    }
    if (fn === 'get_store_features') {
      const combined = await fetchStoreLicenseCombined(params._store_id);
      return { data: combined.features };
    }
    if (fn === 'check_user_limit') {
      return { data: { allowed: true } };
    }
    if (fn === 'get_admin_role') {
      try {
        const res = await fetch(`${API_URL}/rest/v1/admin_roles?user_id=eq.${params._user_id}`, { headers: getHeaders(), credentials: 'same-origin' });
        const roles = await res.json();
        if (roles && roles.length > 0) {
          try { localStorage.setItem(`cached_admin_role_${params._user_id}`, roles[0].role); } catch (_) {}
          return { data: roles[0].role };
        }
        return { data: null };
      } catch (e) {
        try {
          const cached = localStorage.getItem(`cached_admin_role_${params._user_id}`);
          if (cached) return { data: cached };
        } catch (_) {}
        return { data: null };
      }
    }
    if (fn === 'get_store_data') {
      const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isBrowserOffline) {
        try {
          const cachedStr = localStorage.getItem(`cached_store_data_${params._store_id}`);
          if (cachedStr) {
            const cachedData = JSON.parse(cachedStr);
            const offlineSales = await getCachedRecords('sales', params._store_id);
            if (offlineSales && offlineSales.length > 0) {
              const existingIds = new Set((cachedData.sales || []).map((s: any) => s.id));
              const newSales = offlineSales.filter((s: any) => !existingIds.has(s.id));
              cachedData.sales = [...newSales, ...(cachedData.sales || [])];
            }
            return { data: cachedData, error: null };
          }
        } catch (_) {}
      }

      try {
        const res = await fetch(`${API_URL}/rest/v1/rpc/get_store_data`, {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'same-origin',
          body: JSON.stringify(params)
        });
        if (res.ok) {
          const data = await res.json();
          try {
            localStorage.setItem(`cached_store_data_${params._store_id}`, JSON.stringify(data));
            if (Array.isArray(data.items)) cacheRecords('items', data.items).catch(() => {});
            if (Array.isArray(data.customers)) cacheRecords('customers', data.customers).catch(() => {});
            if (Array.isArray(data.suppliers)) cacheRecords('suppliers', data.suppliers).catch(() => {});
            if (Array.isArray(data.expenses)) cacheRecords('expenses', data.expenses).catch(() => {});
            if (Array.isArray(data.sales)) cacheRecords('sales', data.sales).catch(() => {});
            if (Array.isArray(data.categories)) cacheRecords('categories', data.categories).catch(() => {});
            if (Array.isArray(data.payments)) cacheRecords('payments', data.payments).catch(() => {});
            if (Array.isArray(data.returns)) cacheRecords('returns', data.returns).catch(() => {});
            if (Array.isArray(data.stockTransfers)) cacheRecords('stock_transfers', data.stockTransfers).catch(() => {});
            if (Array.isArray(data.purchases)) cacheRecords('purchases', data.purchases).catch(() => {});
            if (Array.isArray(data.staffAccounts)) cacheRecords('staff_accounts', data.staffAccounts).catch(() => {});
          } catch (_) {}
          return { data, error: null };
        } else {
          const err = await res.json();
          return { data: null, error: err };
        }
      } catch (e) {
        try {
          const cachedStr = localStorage.getItem(`cached_store_data_${params._store_id}`);
          if (cachedStr) {
            const cachedData = JSON.parse(cachedStr);
            return { data: cachedData, error: null };
          }
        } catch (_) {}
        return { data: null, error: e };
      }
    }

    return { data: null, error: null };

  },
  post: async (path: string, body: any) => {
    const requestKey = `POST:${API_URL}${path}:${JSON.stringify(body || '')}`;
    if (inFlightRequests.has(requestKey)) {
      return inFlightRequests.get(requestKey)!;
    }

    const exec = async () => {
      const fullUrl = `${API_URL}${path}`;
      const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isBrowserOffline) {
        console.warn(`[Offline Mode] Device offline. Enqueueing mutation for ${fullUrl}`);
        await enqueueSyncItem({
          store_id: body?.store_id,
          action: 'custom_post',
          url: fullUrl,
          method: 'POST',
          payload: body,
        });
        window.dispatchEvent(new CustomEvent('action-complete'));
        return { data: { success: true, offline: true, ...body }, error: null };
      }

      try {
        const extraHeaders: Record<string, string> = {
          'X-Idempotency-Key': generateIdempotencyKey(requestKey)
        };
        const res = await fetch(fullUrl, {
          method: 'POST',
          headers: getHeaders(extraHeaders),
          credentials: 'same-origin',
          body: JSON.stringify(body)
        });
        const data = await res.json();
        window.dispatchEvent(new CustomEvent('action-complete'));
        if (!res.ok) return { data: { error: data.error || data.message || 'Error' }, error: null };
        return { data, error: null };
      } catch (e: any) {
        const isNetworkFailure =
          !navigator.onLine ||
          e?.message?.includes('Failed to fetch') ||
          e?.message?.includes('NetworkError') ||
          e?.message?.includes('network error') ||
          e?.name === 'AbortError';

        if (isNetworkFailure) {
          console.warn(`[Offline Mode] Network failure on POST ${fullUrl}. Saving operation locally to sync queue.`);
          await enqueueSyncItem({
            store_id: body?.store_id,
            action: 'custom_post',
            url: fullUrl,
            method: 'POST',
            payload: body,
          });
          window.dispatchEvent(new CustomEvent('action-complete'));
          return { data: { success: true, offline: true, ...body }, error: null };
        }

        window.dispatchEvent(new CustomEvent('action-error', { detail: e }));
        return { data: { error: (e as Error).message }, error: e };
      } finally {
        setTimeout(() => {
          inFlightRequests.delete(requestKey);
        }, 1500);
      }
    };

    const promise = exec();
    inFlightRequests.set(requestKey, promise);
    return promise;
  },
  functions: {
    invoke: async (fn: string, options: any) => {
      if (fn === 'signup-with-store') {
        try {
          const res = await fetch(`${API_URL}/auth/v1/signup-with-store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(options.body)
          });
          const data = await res.json();
          if (!res.ok) return { data: { error: data.message || 'Signup failed' }, error: null };
          return { data: { success: true }, error: null };
        } catch (error: any) {
          return { data: { error: error.message }, error: null };
        }
      }
      // Mock other edge functions
      return { data: { success: true }, error: null };
    }
  }
};
