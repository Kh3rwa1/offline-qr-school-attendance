import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UserRole } from '../auth/permissions';
import { clearSchoolScopedOfflineData } from '../services/offlineSyncService';

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  status?: string;
}

export interface SchoolMembership {
  id?: string;
  schoolId: string;
  schoolName: string;
  udiseCode?: string;
  role: UserRole;
  status: string;
}

export interface SessionContextType {
  user: User | null;
  memberships: SchoolMembership[];
  activeMembership: SchoolMembership | null;
  activeRole: UserRole | null;
  activeSchoolId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<SchoolMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await api<{
        success: boolean;
        data?: {
          user: User;
          memberships: SchoolMembership[];
          activeSchoolId?: string;
          activeRole?: UserRole;
        };
        sessionContext?: {
          user: User;
          memberships: SchoolMembership[];
          activeMembership?: SchoolMembership;
          schoolId?: string;
        };
      }>('/api/v1/auth/me');

      if (res.data?.user || res.sessionContext?.user) {
        const u = res.data?.user || res.sessionContext!.user;
        const mems = res.data?.memberships || res.sessionContext?.memberships || [];
        const primarySchoolId = res.data?.activeSchoolId || res.sessionContext?.schoolId || mems[0]?.schoolId || 'default-school';
        
        let activeMem = mems.find((m) => m.schoolId === primarySchoolId) || mems[0] || {
          schoolId: primarySchoolId,
          schoolName: 'Primary School',
          role: (res.data?.activeRole || 'TEACHER') as UserRole,
          status: 'ACTIVE',
        };

        setUser(u);
        setMemberships(mems);
        setActiveMembership(activeMem);

        // Store bounded session cache in localStorage
        localStorage.setItem(
          'attendance.auth',
          JSON.stringify({
            user: u,
            memberships: mems,
            schoolId: activeMem.schoolId,
            cachedAt: Date.now(),
            expiresAt: Date.now() + 8 * 3600 * 1000,
          })
        );
      } else {
        setUser(null);
        setMemberships([]);
        setActiveMembership(null);
        localStorage.removeItem('attendance.auth');
      }
    } catch {
      // Offline fallback: check cached session
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
            setUser(parsed.user);
            setMemberships(parsed.memberships || []);
            const mem = parsed.memberships?.find((m: any) => m.schoolId === parsed.schoolId) || parsed.memberships?.[0] || null;
            setActiveMembership(mem);
          } else {
            localStorage.removeItem('attendance.auth');
          }
        } catch {
          localStorage.removeItem('attendance.auth');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (phoneNumber: string, password: string) => {
    setIsLoading(true);
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, password }),
      });
      localStorage.removeItem('attendance.loggedOut');
      await refreshSession();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (activeMembership?.schoolId) {
      await clearSchoolScopedOfflineData(activeMembership.schoolId);
    }
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('attendance.auth');
    localStorage.removeItem('attendance.classSectionId');
    localStorage.removeItem('attendance.deviceIdentifier');
    localStorage.setItem('attendance.loggedOut', 'true');
    setUser(null);
    setMemberships([]);
    setActiveMembership(null);
  };

  const switchSchool = async (schoolId: string) => {
    const targetMem = memberships.find((m) => m.schoolId === schoolId);
    if (!targetMem) {
      throw new Error('You do not have an active membership in the selected school');
    }

    // Call server switch-school endpoint
    await api('/api/v1/auth/switch-school', {
      method: 'POST',
      body: JSON.stringify({ schoolId }),
    }).catch(() => undefined);

    setActiveMembership(targetMem);
    localStorage.setItem(
      'attendance.auth',
      JSON.stringify({
        user,
        memberships,
        schoolId,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 8 * 3600 * 1000,
      })
    );
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        memberships,
        activeMembership,
        activeRole: activeMembership?.role || null,
        activeSchoolId: activeMembership?.schoolId || null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchSchool,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
