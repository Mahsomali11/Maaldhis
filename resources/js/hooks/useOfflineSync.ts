import { useState, useEffect, useCallback } from 'react';
import { syncManager } from '@/lib/offline/syncManager';
import { toast } from 'sonner';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(syncManager.isOnline);
  const [isSyncing, setIsSyncing] = useState<boolean>(syncManager.isSyncing);
  const [pendingCount, setPendingCount] = useState<number>(syncManager.pendingCount);

  useEffect(() => {
    const handleNetworkChange = (e: any) => {
      setIsOnline(e.detail?.isOnline ?? navigator.onLine);
    };

    const handleCountChange = (e: any) => {
      setPendingCount(e.detail?.count ?? 0);
    };

    const handleStatusChange = (e: any) => {
      if (e.detail) {
        setIsOnline(e.detail.isOnline);
        setIsSyncing(e.detail.isSyncing);
        setPendingCount(e.detail.pendingCount);
      }
    };

    const handleSyncComplete = (e: any) => {
      const synced = e.detail?.synced || 0;
      if (synced > 0) {
        toast.success(`Synchronized ${synced} offline transaction${synced > 1 ? 's' : ''} to cloud`, {
          duration: 3500,
        });
      }
    };

    window.addEventListener('network-status-changed', handleNetworkChange);
    window.addEventListener('sync-count-changed', handleCountChange);
    window.addEventListener('sync-status-changed', handleStatusChange);
    window.addEventListener('sync-completed', handleSyncComplete);

    // Initial check
    syncManager.refreshQueueCount().then(c => setPendingCount(c));

    return () => {
      window.removeEventListener('network-status-changed', handleNetworkChange);
      window.removeEventListener('sync-count-changed', handleCountChange);
      window.removeEventListener('sync-status-changed', handleStatusChange);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline) {
      toast.error('Device is currently offline. Reconnect to internet to sync.');
      return;
    }
    toast.info('Starting manual data synchronization...');
    const result = await syncManager.flushQueue();
    if (result.synced === 0 && result.failed === 0) {
      toast.success('All local data is already up to date!');
    }
  }, [isOnline]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncNow,
  };
}

