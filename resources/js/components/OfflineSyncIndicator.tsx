import React from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';

interface Props {
  className?: string;
  showWhenSynced?: boolean;
  compact?: boolean;
}

export default function OfflineSyncIndicator({ className = '', showWhenSynced = true, compact = false }: Props) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  // If online and nothing pending, we can show a subtle online badge or minimal indicator
  if (isOnline && pendingCount === 0 && !isSyncing) {
    if (!showWhenSynced) return null;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 select-none ${className}`}
        title="Connected to cloud server. All data is synchronized."
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className={compact ? 'text-[10px]' : 'hidden sm:inline'}>Online</span>
      </div>
    );
  }

  // When syncing
  if (isSyncing) {
    return (
      <button
        onClick={syncNow}
        disabled
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 select-none shadow-sm ${className}`}
        title={`Syncing ${pendingCount} offline records to server...`}
      >
        <RefreshCw size={12} className="animate-spin text-cyan-500 shrink-0" />
        <span>{compact ? `${pendingCount}` : `Syncing (${pendingCount})...`}</span>
      </button>
    );
  }

  // When offline
  if (!isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 select-none shadow-sm ${className}`}
        title={pendingCount > 0 ? `${pendingCount} operations queued locally. Will sync automatically when reconnected.` : 'Device is offline. Local changes will be saved safely.'}
      >
        <WifiOff size={12} className="text-amber-500 animate-pulse shrink-0" />
        <span>{compact ? 'Offline' : 'Offline Mode'}</span>
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  // Online but has pending items waiting to be synced
  return (
    <button
      onClick={syncNow}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30 hover:bg-blue-500/25 transition-all select-none shadow-sm cursor-pointer ${className}`}
      title="Click to manually push pending offline changes to server now"
    >
      <CloudUpload size={13} className="text-blue-500 shrink-0" />
      <span>{compact ? `Sync (${pendingCount})` : `Sync Pending (${pendingCount})`}</span>
    </button>
  );
}
