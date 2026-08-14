import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
      setLastSyncedAt(new Date());
      await refreshOutbox();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, activeSchoolId, refreshOutbox]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncNow();
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
