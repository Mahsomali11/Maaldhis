/**
 * Maaldhis Offline-First IndexedDB Storage Engine
 * Provides persistent client-side caching for all tables and an offline mutation queue.
 */

const DB_NAME = 'maaldhis_offline_v1';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string;
  store_id?: string;
  table: string;
  action: 'insert' | 'update' | 'delete' | 'custom_post';
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: any;
  created_at: string;
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed';
  last_error?: string;
}

export interface CachedRecordEntry {
  cache_key: string; // `${table}::${id}`
  table: string;
  id: string;
  store_id?: string;
  data: any;
  updated_at: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Cached records store
      if (!db.objectStoreNames.contains('cached_records')) {
        const recordStore = db.createObjectStore('cached_records', { keyPath: 'cache_key' });
        recordStore.createIndex('by_table', 'table', { unique: false });
        recordStore.createIndex('by_store', 'store_id', { unique: false });
        recordStore.createIndex('by_table_and_store', ['table', 'store_id'], { unique: false });
      }

      // 2. Offline sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('by_status', 'status', { unique: false });
        queueStore.createIndex('by_created_at', 'created_at', { unique: false });
        queueStore.createIndex('by_table', 'table', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Save or update a single record in the local cache.
 */
export async function cacheRecord(table: string, record: any): Promise<void> {
  if (!record || typeof record !== 'object') return;
  const id = record.id || record.uuid || String(Date.now());
  const storeId = record.store_id || undefined;
  const cacheKey = `${table}::${id}`;

  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cached_records', 'readwrite');
    const store = tx.objectStore('cached_records');

    const entry: CachedRecordEntry = {
      cache_key: cacheKey,
      table,
      id: String(id),
      store_id: storeId ? String(storeId) : undefined,
      data: record,
      updated_at: new Date().toISOString(),
    };

    store.put(entry);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[OfflineDB] Failed to cache record in ${table}:`, err);
  }
}

/**
 * Bulk save records into the local cache.
 */
export async function cacheRecords(table: string, records: any[]): Promise<void> {
  if (!Array.isArray(records) || records.length === 0) return;

  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cached_records', 'readwrite');
    const store = tx.objectStore('cached_records');
    const now = new Date().toISOString();

    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      const id = record.id || record.uuid || String(Date.now() + Math.random());
      const storeId = record.store_id || undefined;
      const cacheKey = `${table}::${id}`;

      store.put({
        cache_key: cacheKey,
        table,
        id: String(id),
        store_id: storeId ? String(storeId) : undefined,
        data: record,
        updated_at: now,
      });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[OfflineDB] Failed to bulk cache records in ${table}:`, err);
  }
}

/**
 * Retrieve cached records for a given table and optional store_id.
 */
export async function getCachedRecords(table: string, storeId?: string): Promise<any[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cached_records', 'readonly');
    const store = tx.objectStore('cached_records');

    let request: IDBRequest<any[]>;
    if (storeId) {
      const index = store.index('by_table_and_store');
      request = index.getAll([table, String(storeId)]);
    } else {
      const index = store.index('by_table');
      request = index.getAll(table);
    }

    const results = await new Promise<CachedRecordEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return results.map(entry => entry.data);
  } catch (err) {
    console.warn(`[OfflineDB] Failed to get cached records for ${table}:`, err);
    return [];
  }
}

/**
 * Retrieve a single record from cache by ID.
 */
export async function getCachedRecord(table: string, id: string): Promise<any | null> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cached_records', 'readonly');
    const store = tx.objectStore('cached_records');
    const cacheKey = `${table}::${id}`;

    const request = store.get(cacheKey);
    const entry = await new Promise<CachedRecordEntry | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return entry ? entry.data : null;
  } catch (err) {
    return null;
  }
}

/**
 * Remove a single record from local cache.
 */
export async function removeCachedRecord(table: string, id: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('cached_records', 'readwrite');
    const store = tx.objectStore('cached_records');
    store.delete(`${table}::${id}`);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[OfflineDB] Failed to remove cached record:`, err);
  }
}

/**
 * Enqueue a mutating operation to the offline sync queue.
 */
export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, 'id' | 'created_at' | 'retry_count' | 'status'> & { id?: string }
): Promise<SyncQueueItem> {
  const db = await openOfflineDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');

  const queueItem: SyncQueueItem = {
    id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`),
    store_id: item.store_id,
    table: item.table,
    action: item.action,
    url: item.url,
    method: item.method,
    headers: item.headers,
    payload: item.payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    status: 'pending',
  };

  store.put(queueItem);

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Dispatch global window event so indicators update immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: { item: queueItem } }));
  }

  return queueItem;
}

/**
 * Fetch all pending sync items ordered by created_at.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const index = store.index('by_status');

    const request = index.getAll('pending');
    const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Sort FIFO (oldest first) to maintain chronological order
    return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch (err) {
    console.warn('[OfflineDB] Failed to get pending sync items:', err);
    return [];
  }
}

/**
 * Count total items waiting in sync queue.
 */
export async function getSyncQueueCount(): Promise<number> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.count();

    return await new Promise<number>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return 0;
  }
}

/**
 * Update the status or error of a sync queue item.
 */
export async function updateSyncItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');

    const request = store.get(id);
    request.onsuccess = () => {
      const existing = request.result;
      if (existing) {
        store.put({ ...existing, ...updates });
      }
    };

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-queue-updated'));
    }
  } catch (err) {
    console.warn('[OfflineDB] Failed to update sync item:', err);
  }
}

/**
 * Remove an item from the sync queue after successful replication.
 */
export async function removeSyncItem(id: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.delete(id);

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-queue-updated'));
    }
  } catch (err) {
    console.warn('[OfflineDB] Failed to remove sync item:', err);
  }
}

