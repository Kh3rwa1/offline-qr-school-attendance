import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudUpload, CheckCircle2 } from 'lucide-react';
import { getOutboxStatus, syncOutboxEvents } from '../services/offlineSyncService';

interface NetworkSyncBarProps {
  schoolId?: string;
  deviceIdentifier?: string;
  onSyncComplete?: () => void;
}

export const NetworkSyncBar: React.FC<NetworkSyncBarProps> = ({
  schoolId,
  deviceIdentifier,
  onSyncComplete,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [lastSyncStatus, setLastSyncStatus] = useState<string | null>(null);

  const refreshOutboxCount = async () => {
    try {
      const status = await getOutboxStatus();
      setUnsyncedCount(status.unsyncedTotal);
    } catch {
      // Ignore in non-IndexedDB environments
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (schoolId) {
        handleTriggerSync();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshOutboxCount();
    const interval = setInterval(refreshOutboxCount, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [schoolId]);

  const handleTriggerSync = async () => {
    if (!schoolId || isSyncing) return;
    setIsSyncing(true);
    setLastSyncStatus(null);

    try {
      const res = await syncOutboxEvents({ schoolId, deviceIdentifier });
      await refreshOutboxCount();
      if (res.syncedCount > 0) {
        setLastSyncStatus(`Synced ${res.syncedCount} scans successfully`);
      }
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      setLastSyncStatus(`Sync failed: ${err.message || 'Network error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      id="network-sync-bar"
      className={`w-full py-2 px-4 flex items-center justify-between text-xs font-medium border-b transition-colors ${
        !isOnline
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
          : unsyncedCount > 0
          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <span className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <span id="pwa-status-pill" className="bg-amber-500/20 px-2 py-0.5 rounded text-[11px]">
              OFFLINE
            </span>
            <span className="hidden sm:inline">Local scans will queue in outbox</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <Wifi className="w-4 h-4 text-emerald-600" />
            <span id="pwa-status-pill" className="bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-semibold">
              ONLINE
            </span>
          </span>
        )}

        {unsyncedCount > 0 && (
          <span id="unsynced-outbox-pill" className="ml-2 bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <CloudUpload className="w-3 h-3" />
            {unsyncedCount} Pending Scan{unsyncedCount > 1 ? 's' : ''}
          </span>
        )}

        {lastSyncStatus && (
          <span className="ml-2 text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {lastSyncStatus}
          </span>
        )}
      </div>

      {schoolId && (unsyncedCount > 0 || !isOnline) && (
        <button
          id="sync-now-button"
          onClick={handleTriggerSync}
          disabled={!isOnline || isSyncing || unsyncedCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};
