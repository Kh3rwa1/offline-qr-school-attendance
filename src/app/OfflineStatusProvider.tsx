import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getOutboxStatus, syncOutboxEvents } from '../services/offlineSyncService';
import { useSession } from './SessionProvider';

export interface OfflineStatusContextType {
  isOnline: boolean;
  outboxCount: number;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncNow: () => Promise<void>;
  refreshOutbox: () => Promise<void>;
}

const OfflineStatusContext = createContext<OfflineStatusContextType | undefined>(undefined);

export const OfflineStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const { activeSchoolId } = useSession();
  const syncFailureCount = useRef<number>(0);

  const refreshOutbox = useCallback(async () => {
    try {
      const status = await getOutboxStatus();
      setOutboxCount(status.unsyncedTotal);
    } catch {
      // Non-IndexedDB fallback
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing || !activeSchoolId) return;
    setIsSyncing(true);
    try {
      const deviceIdentifier = localStorage.getItem('attendance.deviceIdentifier') || 'browser-client';
      await syncOutboxEvents({ schoolId: activeSchoolId, deviceIdentifier });
      syncFailureCount.current = 0;
      setLastSyncedAt(new Date());
      await refreshOutbox();
    } catch (err: any) {
      syncFailureCount.current = Math.min(syncFailureCount.current + 1, 5);
      console.warn(`[OfflineSync] Outbox synchronization error (attempt failure count: ${syncFailureCount.current}):`, err?.message || err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, activeSchoolId, refreshOutbox]);

  // Online / Offline window listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    void refreshOutbox();
    const interval = setInterval(refreshOutbox, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshOutbox, syncNow]);

  // Autonomous background sync: When online and outbox has unsynced items, debounce 5s and sync
  useEffect(() => {
    if (!isOnline || outboxCount <= 0 || isSyncing || !activeSchoolId) {
      return;
    }

    const backoffDelay = Math.min(30000, 5000 * Math.pow(1.5, syncFailureCount.current));
    const timer = setTimeout(() => {
      void syncNow().catch(() => {});
    }, backoffDelay);

    return () => clearTimeout(timer);
  }, [isOnline, outboxCount, isSyncing, activeSchoolId, syncNow]);

  return (
    <OfflineStatusContext.Provider
      value={{
        isOnline,
        outboxCount,
        isSyncing,
        lastSyncedAt,
        syncNow,
        refreshOutbox,
      }}
    >
      {children}
    </OfflineStatusContext.Provider>
  );
};

export function useOfflineStatus() {
  const context = useContext(OfflineStatusContext);
  if (!context) {
    throw new Error('useOfflineStatus must be used within an OfflineStatusProvider');
  }
  return context;
}
