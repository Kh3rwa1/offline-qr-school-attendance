import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudUpload, CheckCircle2 } from 'lucide-react';
import { getOutboxStatus, syncOutboxEvents } from '../services/offlineSyncService';
import { Button } from './shared/Button';

interface NetworkSyncBarProps {
  schoolId?: string;
  deviceIdentifier: string;
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
          ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
          : unsyncedCount > 0
          ? 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30'
          : 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <span className="flex items-center gap-1.5 font-semibold text-warning-800">
            <WifiOff className="w-4 h-4 text-warning-600" />
            <span id="pwa-status-pill" className="bg-warning-100 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              OFFLINE
            </span>
            <span className="hidden sm:inline text-xs">Local scans will queue in outbox</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-success-800">
            <Wifi className="w-4 h-4 text-success-600" />
            <span id="pwa-status-pill" className="bg-success-100 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              ONLINE
            </span>
          </span>
        )}

        {unsyncedCount > 0 && (
          <span id="unsynced-outbox-pill" className="ml-2 bg-warning-100 text-warning-800 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] flex items-center gap-1">
            <CloudUpload className="w-3.5 h-3.5" />
            {unsyncedCount} Pending Scan{unsyncedCount > 1 ? 's' : ''}
          </span>
        )}

        {lastSyncStatus && (
          <span className="ml-2 text-ink-soft flex items-center gap-1 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
            {lastSyncStatus}
          </span>
        )}
      </div>

      {schoolId && (unsyncedCount > 0 || !isOnline) && (
        <button
          id="sync-now-button"
          onClick={handleTriggerSync}
          disabled={!isOnline || isSyncing || unsyncedCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-forest-700 hover:bg-forest-800 disabled:opacity-50 text-white rounded-full text-xs font-bold shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed font-display"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  );
};

export default NetworkSyncBar;
