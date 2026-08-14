import React, { createContext, useContext, useMemo } from 'react';
import { useSession, SchoolMembership } from './SessionProvider';
import { UserRole } from '../auth/permissions';

export interface ActiveSchoolContextType {
  activeSchoolId: string | null;
  activeSchoolName: string;
  activeRole: UserRole | null;
  availableSchools: SchoolMembership[];
  hasSelectedSchool: boolean;
  switchSchool: (schoolId: string) => Promise<void>;
}

const ActiveSchoolContext = createContext<ActiveSchoolContextType | undefined>(undefined);

export const ActiveSchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeMembership, memberships, platformRole, activeRole, switchSchool } = useSession();

  const value = useMemo(
    () => ({
      activeSchoolId: activeMembership?.schoolId || null,
      activeSchoolName: activeMembership?.schoolName || (platformRole === 'SUPER_ADMIN' ? 'State Platform Administration' : 'No School Selected'),
      activeRole: activeRole,
      availableSchools: memberships,
      hasSelectedSchool: Boolean(activeMembership?.schoolId),
      switchSchool,
    }),
    [activeMembership, memberships, platformRole, activeRole, switchSchool]
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
