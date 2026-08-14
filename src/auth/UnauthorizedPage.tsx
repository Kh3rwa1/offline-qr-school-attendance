import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useSession } from '../app/SessionProvider';
import { getDefaultRouteForRole } from './permissions';

export const UnauthorizedPage: React.FC<{ message?: string }> = ({
  message = 'You do not have permission to access this resource or dashboard.',
}) => {
  const navigate = useNavigate();
  const { activeRole } = useSession();

  const handleReturn = () => {
    navigate(getDefaultRouteForRole(activeRole || undefined));
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">403 — Access Denied</h2>
          <p className="text-xs text-slate-500 mt-2 font-medium">{message}</p>
        </div>
        <div className="pt-2">
          <button
            onClick={handleReturn}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-colors"
            id="return-authorized-dashboard-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Authorized Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
