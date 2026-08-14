import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { getDefaultRouteForRole } from '../auth/permissions';

export const AuthenticatedApp: React.FC = () => {
  const { activeRole, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-600 font-bold text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p>Redirecting to your workspace…</p>
        </div>
      </div>
    );
  }

  const destination = getDefaultRouteForRole(activeRole || undefined);
  return <Navigate to={destination} replace />;
};

export default AuthenticatedApp;
