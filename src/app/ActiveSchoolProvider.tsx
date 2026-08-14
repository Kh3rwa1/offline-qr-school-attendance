import React, { createContext, useContext, useMemo } from 'react';
import { useSession, SchoolMembership } from './SessionProvider';
import { UserRole } from '../auth/permissions';

export interface ActiveSchoolContextType {
  activeSchoolId: string | null;
  activeSchoolName: string;
  activeRole: UserRole | null;
  availableSchools: SchoolMembership[];
  switchSchool: (schoolId: string) => Promise<void>;
}

const ActiveSchoolContext = createContext<ActiveSchoolContextType | undefined>(undefined);

export const ActiveSchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeMembership, memberships, switchSchool } = useSession();

  const value = useMemo(
    () => ({
      activeSchoolId: activeMembership?.schoolId || null,
      activeSchoolName: activeMembership?.schoolName || 'Default School',
      activeRole: activeMembership?.role || null,
      availableSchools: memberships,
      switchSchool,
    }),
    [activeMembership, memberships, switchSchool]
  );

  return <ActiveSchoolContext.Provider value={value}>{children}</ActiveSchoolContext.Provider>;
};

export function useActiveSchool() {
  const context = useContext(ActiveSchoolContext);
  if (!context) {
    throw new Error('useActiveSchool must be used within an ActiveSchoolProvider');
  }
  return context;
}
