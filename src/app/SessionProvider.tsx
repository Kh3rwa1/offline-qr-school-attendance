import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UserRole } from '../auth/permissions';
import { clearSchoolScopedOfflineData } from '../services/offlineSyncService';
import { queryClient } from '../services/queryClient';

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  platformRole?: UserRole | null;
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
  platformRole: UserRole | null;
  memberships: SchoolMembership[];
  activeMembership: SchoolMembership | null;
  activeRole: UserRole | null;
  activeSchoolId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phoneNumber: string, password: string, schoolId?: string) => Promise<UserRole>;
  logout: () => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSession: () => Promise<{ user: User; role: UserRole | null } | null>;
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
        if (parsed.expiresAt && parsed.expiresAt > Date.now() && parsed.schoolId) {
          return parsed.memberships?.find((m: any) => m.schoolId === parsed.schoolId) || null;
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

  const refreshSession = useCallback(async (): Promise<{ user: User; role: UserRole | null } | null> => {
    try {
      const res = await api<{
        user?: User;
        sessionContext?: {
          user: User;
          platformRole?: string | null;
          memberships: SchoolMembership[];
          activeMembership?: {
            schoolId: string;
            role: string;
            status: string;
          };
          schoolId?: string | null;
        };
      }>('/api/v1/auth/me');

      if (res.user || res.sessionContext?.user) {
        const u: User = res.user || res.sessionContext!.user;
        const mems = res.sessionContext?.memberships || [];
        const rawActive = res.sessionContext?.activeMembership;
        const platformRole = (res.sessionContext?.platformRole || u.platformRole || (mems.some(m => m.role === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : null)) as UserRole | null;
        
        let activeMem: SchoolMembership | null = null;
        if (rawActive && rawActive.schoolId) {
          activeMem = {
            schoolId: rawActive.schoolId,
            schoolName: mems.find((m) => m.schoolId === rawActive.schoolId)?.schoolName || 'Active School',
            role: rawActive.role as UserRole,
            status: rawActive.status,
          };
        } else if (mems.length > 0 && !platformRole) {
          activeMem = mems[0];
        }

        setUser(u);
        setMemberships(mems);
        setActiveMembership(activeMem);

        localStorage.setItem(
          'attendance.auth',
          JSON.stringify({
            user: u,
            memberships: mems,
            schoolId: activeMem?.schoolId || null,
            cachedAt: Date.now(),
            expiresAt: Date.now() + 8 * 3600 * 1000,
          })
        );
        const resolvedRole = activeMem?.role || platformRole || null;
        return { user: u, role: resolvedRole };
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
            const mem = parsed.memberships?.find((m: any) => m.schoolId === parsed.schoolId) || null;
            setActiveMembership(mem);
            const resolvedRole = mem?.role || parsed.user?.platformRole || null;
            return { user: parsed.user, role: resolvedRole };
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

  const login = async (phoneNumber: string, password: string, schoolId?: string): Promise<UserRole> => {
    setIsLoading(true);
    try {
      const res = await api<{
        user: User;
        platformRole?: UserRole | null;
        activeSchoolId?: string | null;
        memberships: SchoolMembership[];
        csrfToken?: string;
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, password, schoolId }),
      });
      localStorage.removeItem('attendance.loggedOut');
      const refreshed = await refreshSession();
      const resolved = refreshed?.role || res.platformRole || res.memberships[0]?.role;
      if (!resolved) {
        throw new Error('User has no authorized role in the system');
      }
      return resolved as UserRole;
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
    queryClient.clear();
  };

  const switchSchool = async (schoolId: string) => {
    const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN' || memberships.some((m) => m.role === 'SUPER_ADMIN');
    const targetMem = memberships.find((m) => m.schoolId === schoolId);
    
    if (!targetMem && !isSuperAdmin) {
      throw new Error('You do not have an active membership in the selected school');
    }

    // Call server switch-school endpoint and await success
    const res = await api<{
      success: boolean;
      activeSchoolId: string;
      activeRole: string;
      csrfToken?: string;
    }>('/api/v1/auth/switch-school', {
      method: 'POST',
      body: JSON.stringify({ schoolId }),
    });

    if (!res.success) {
      throw new Error('Failed to switch school on server');
    }

    // Invalidate all school-scoped query caches to prevent cross-tenant exposure
    await queryClient.cancelQueries();
    queryClient.clear();

    await refreshSession();
  };

  const platformRole = (user?.platformRole || (memberships.some(m => m.role === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : null)) as UserRole | null;
  const activeRole = (activeMembership?.role || platformRole || null) as UserRole | null;

  return (
    <SessionContext.Provider
      value={{
        user,
        platformRole,
        memberships,
        activeMembership,
        activeRole,
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
