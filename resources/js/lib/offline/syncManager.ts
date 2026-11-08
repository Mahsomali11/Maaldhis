/**
 * Automated Background Synchronization Manager
 * Listens for network restoration and replays queued offline operations sequentially.
 */

import {
  getPendingSyncItems,
  removeSyncItem,
  updateSyncItem,
  getSyncQueueCount,
  cacheRecord,
  SyncQueueItem,
} from './indexedDb';

export type SyncState = 'online' | 'offline' | 'syncing';

class OfflineSyncManager {
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncingStatus: boolean = false;
  private pendingCountStatus: number = 0;
  private pingInterval: any = null;
  private syncTimeout: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
      window.addEventListener('sync-queue-updated', () => this.refreshQueueCount());

      // Periodic check every 25 seconds for reliable true connectivity
      this.pingInterval = setInterval(() => {
        this.verifyConnectivity();
      }, 25000);

      // Initial count check
      this.refreshQueueCount();
    }
  }

  public get isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public get isSyncing(): boolean {
    return this.isSyncingStatus;
  }

  public get pendingCount(): number {
    return this.pendingCountStatus;
  }

  /**
   * Check connection health by probing a lightweight public endpoint.
   */
  public async verifyConnectivity(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!navigator.onLine) {
      this.setOnline(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/system-branding', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const isReachable = res.ok || res.status === 401; // 401 still means reachable server
      this.setOnline(isReachable);

      if (isReachable && this.pendingCountStatus > 0 && !this.isSyncingStatus) {
        this.flushQueue();
      }

      return isReachable;
    } catch (e) {
      this.setOnline(false);
      return false;
    }
  }

  private setOnline(online: boolean) {
    const changed = this.isOnlineStatus !== online;
    this.isOnlineStatus = online;

    if (changed && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('network-status-changed', {
          detail: { isOnline: online },
        })
      );
    }
  }

  private handleNetworkChange(online: boolean) {
    this.setOnline(online);
    if (online) {
      // Recheck true connectivity before starting sync
      setTimeout(() => {
        this.verifyConnectivity().then(reachable => {
          if (reachable) {
            this.flushQueue();
          }
        });
      }, 1000);
    }
  }

  public async refreshQueueCount(): Promise<number> {
    try {
      const count = await getSyncQueueCount();
      this.pendingCountStatus = count;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sync-count-changed', {
            detail: { count },
          })
        );
      }
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Process and replay all pending operations in chronological order.
   */
  public async flushQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncingStatus) return { synced: 0, failed: 0 };
    if (!this.isOnlineStatus) return { synced: 0, failed: 0 };

    const items = await getPendingSyncItems();
    if (items.length === 0) {
      this.refreshQueueCount();
      return { synced: 0, failed: 0 };
    }

    this.isSyncingStatus = true;
    this.dispatchStatus('syncing');

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await updateSyncItem(item.id, { status: 'syncing' });

        // Retrieve CSRF token from document
        let csrfToken = '';
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
          if (match) csrfToken = decodeURIComponent(match[1]);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Idempotency-Key': item.id,
          ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
          ...(item.headers || {}),
        };

        const res = await fetch(item.url, {
          method: item.method,
          credentials: 'same-origin',
          headers,
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (res.ok || res.status === 201 || res.status === 204) {
          // Successfully synced!
          await removeSyncItem(item.id);
          synced++;

          // Try caching the response if it returned fresh data
          try {
            if (res.status !== 204) {
              const resData = await res.json();
              if (resData && typeof resData === 'object' && item.table) {
                await cacheRecord(item.table, resData);
              }
            }
          } catch (_) {}
        } else if (res.status === 409 || res.status === 422) {
          // If already created or validation conflict, remove from queue to avoid infinite blockage
          const errText = await res.text().catch(() => '');
          if (errText.includes('already exists') || errText.includes('Duplicate entry') || res.status === 409) {
            await removeSyncItem(item.id);
            synced++;
          } else {
            // Keep with failed status
            await updateSyncItem(item.id, {
              status: 'failed',
              retry_count: item.retry_count + 1,
              last_error: `Server rejected (${res.status}): ${errText.slice(0, 100)}`,
            });
            failed++;
          }
        } else if (res.status === 401 || res.status === 419) {
          // Authentication expired, pause sync until user logs back in
          await updateSyncItem(item.id, { status: 'pending' });
          break;
        } else {
          await updateSyncItem(item.id, {
            status: 'pending',
            retry_count: item.retry_count + 1,
            last_error: `HTTP ${res.status}`,
          });
          failed++;
        }
      } catch (networkErr: any) {
        // Network dropped midway through flush
        this.setOnline(false);
        await updateSyncItem(item.id, {
          status: 'pending',
          last_error: networkErr?.message || 'Network error',
        });
        failed++;
        break;
      }
    }

    this.isSyncingStatus = false;
    await this.refreshQueueCount();
    this.dispatchStatus(this.isOnlineStatus ? 'online' : 'offline');

    if (synced > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sync-completed', {
          detail: { synced, remaining: this.pendingCountStatus },
        })
      );
    }

    return { synced, failed };
  }

  private dispatchStatus(status: SyncState) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sync-status-changed', {
          detail: {
            status,
            isOnline: this.isOnlineStatus,
            isSyncing: this.isSyncingStatus,
            pendingCount: this.pendingCountStatus,
          },
        })
      );
    }
  }
}

export const syncManager = new OfflineSyncManager();
