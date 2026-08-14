import React from 'react';
import { useSession } from '../app/SessionProvider';
import { UserRole } from './permissions';
import { UnauthorizedPage } from './UnauthorizedPage';

export const RequireRole: React.FC<{
  allowedRoles: UserRole[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { activeRole, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600 font-bold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p>Verifying role authorization…</p>
        </div>
      </div>
    );
  }

  // SUPER_ADMIN has global role access
  if (activeRole === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return (
      <UnauthorizedPage
        message={`This workspace requires one of the following roles: ${allowedRoles.join(
          ', '
        )}. Your current active role is ${activeRole || 'NONE'}.`}
      />
    );
  }

  return <>{children}</>;
};

export default RequireRole;
