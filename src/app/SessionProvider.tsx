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
  login: (phoneNumber: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSession: () => Promise<{ user: User; role: UserRole } | null>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) return parsed.user;
      }
    } catch {}
    return null;
  });

  const [memberships, setMemberships] = useState<SchoolMembership[]>(() => {
    try {
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) return parsed.memberships || [];
      }
    } catch {}
    return [];
  });

  const [activeMembership, setActiveMembership] = useState<SchoolMembership | null>(() => {
    try {
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          return parsed.memberships?.find((m: any) => m.schoolId === parsed.schoolId) || parsed.memberships?.[0] || null;
        }
      }
    } catch {}
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('attendance.auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) return false;
      }
    } catch {}
    return true;
  });

  const refreshSession = useCallback(async (): Promise<{ user: User; role: UserRole } | null> => {
    try {
      const res = await api<{
        user?: User;
        sessionContext?: {
          user: User;
          memberships: SchoolMembership[];
          activeMembership?: {
            schoolId: string;
            role: string;
            status: string;
          };
          schoolId?: string;
        };
      }>('/api/v1/auth/me');

      if (res.user || res.sessionContext?.user) {
        const u = res.user || res.sessionContext!.user;
        const mems = res.sessionContext?.memberships || [];
        const rawActive = res.sessionContext?.activeMembership;
        const activeMem: SchoolMembership = rawActive
          ? {
              schoolId: rawActive.schoolId,
              schoolName: mems.find((m) => m.schoolId === rawActive.schoolId)?.schoolName || 'Active School',
              role: rawActive.role as UserRole,
              status: rawActive.status,
            }
          : mems[0] || {
              schoolId: 'default-school',
              schoolName: 'Primary School',
              role: 'TEACHER' as UserRole,
              status: 'ACTIVE',
            };

        setUser(u);
        setMemberships(mems);
        setActiveMembership(activeMem);

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
        return { user: u, role: activeMem.role as UserRole };
      } else {
        setUser(null);
        setMemberships([]);
        setActiveMembership(null);
        localStorage.removeItem('attendance.auth');
        return null;
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
            return mem ? { user: parsed.user, role: mem.role } : null;
          } else {
            localStorage.removeItem('attendance.auth');
          }
        } catch {
          localStorage.removeItem('attendance.auth');
        }
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (phoneNumber: string, password: string): Promise<UserRole> => {
    setIsLoading(true);
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, password }),
      });
      localStorage.removeItem('attendance.loggedOut');
      const result = await refreshSession();
      return result?.role || 'TEACHER';
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
