import React from 'react';
import { useSession } from '../app/SessionProvider';
import { Permission, hasPermission } from './permissions';
import { UnauthorizedPage } from './UnauthorizedPage';

export const RequirePermission: React.FC<{
  permission: Permission;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  const { activeRole, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600 font-bold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p>Verifying capability authorization…</p>
        </div>
      </div>
    );
  }

  if (!hasPermission(activeRole || undefined, permission)) {
    return (
      <UnauthorizedPage
        message={`Required permission '${permission}' is not granted to active role '${activeRole || 'NONE'}'.`}
      />
    );
  }

  return <>{children}</>;
};

export default RequirePermission;
