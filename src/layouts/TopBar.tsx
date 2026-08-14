import React, { useState } from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../app/OfflineStatusProvider';
import { SchoolSwitcher } from './SchoolSwitcher';
import { LogOut, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { user, logout, activeRole } = useSession();
  const { activeSchoolName } = useActiveSchool();
  const { isOnline, outboxCount, isSyncing, syncNow } = useOfflineStatus();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Active School & Tenant Switcher */}
      <div className="flex items-center gap-3">
        <div>
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
            id="open-school-switcher-btn"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              🏫
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 leading-tight">
                  {activeRole === 'SUPER_ADMIN' ? 'Platform Management Console' : activeSchoolName}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">▼</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Click to switch school</span>
            </div>
          </button>
        </div>
      </div>

      {/* Right: Sync telemetry, User badge, Sign Out */}
      <div className="flex items-center gap-3">
        {/* Offline sync button indicator */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
          {isOnline ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <Wifi className="w-3.5 h-3.5" />
              Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <WifiOff className="w-3.5 h-3.5" />
              Offline
            </span>
          )}

          <span className="text-[10px] text-slate-500 font-bold">{outboxCount} unsynced</span>

          <button
            onClick={() => void syncNow()}
            disabled={!isOnline || isSyncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors disabled:opacity-50"
            id="sync-now-topbar-btn"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronizing…' : 'Synchronize now'}
          </button>
        </div>

        {/* User profile */}
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-800">{user?.fullName || 'User'}</span>
          <span className="text-[10px] font-semibold text-indigo-600">{activeRole || 'TEACHER'}</span>
        </div>

        {/* Sign out */}
        <button
          onClick={() => void logout()}
          className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Sign out"
          id="logout-btn"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* School Switcher Modal */}
      <SchoolSwitcher isOpen={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </header>
  );
};

export default TopBar;
