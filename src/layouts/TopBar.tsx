import React, { useState } from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../app/OfflineStatusProvider';
import { SchoolSwitcher } from './SchoolSwitcher';
import { Search, Bell, Mail, Wifi, WifiOff, RefreshCw, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const TopBar: React.FC = () => {
  const { user, activeRole } = useSession();
  const { activeSchoolName } = useActiveSchool();
  const { isOnline, outboxCount, isSyncing, syncNow } = useOfflineStatus();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-20 bg-transparent px-6 sm:px-8 flex items-center justify-between border-b border-slate-100/80">
      {/* Left: Rounded Pill Search Input */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, class, or roll number…"
            className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200/80 rounded-full text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#144e39] focus:ring-2 focus:ring-[#144e39]/10 transition-all outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs font-mono">
            ⌘ F
          </span>
        </div>
      </div>

      {/* Right: Quick School Switcher, Notification Bells, User Profile */}
      <div className="flex items-center gap-4">
        {/* School Tenant Switcher Pill */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSwitcherOpen(true)}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-all"
        >
          <span className="text-sm">🏫</span>
          <span className="max-w-44 truncate">{activeSchoolName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </motion.button>

        {/* Sync Telemetry Badge */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition-all text-xs font-bold"
        >
          {isOnline ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          )}
          <span className="text-slate-700 text-[11px] hidden sm:inline">
            {isSyncing ? 'Syncing…' : `${outboxCount} unsynced`}
          </span>
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
        </motion.button>

        {/* Icon Action Buttons */}
        <div className="flex items-center gap-2">
          <motion.button 
            whileHover={{ scale: 1.08, y: -1 }}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
          >
            <Mail className="w-4 h-4" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.08, y: -1 }}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs relative"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2.5 right-2.5 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2.5 right-2.5"></span>
          </motion.button>
        </div>

        {/* User Profile Info */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 pl-2 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-[#144e39] text-white flex items-center justify-center text-sm font-bold shadow-md shadow-[#144e39]/20">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-extrabold text-slate-900 leading-tight font-display">{user?.fullName || 'Administrator'}</span>
            <span className="text-[11px] font-medium text-slate-400">{user?.phoneNumber || activeRole || 'Active Member'}</span>
          </div>
        </motion.div>
      </div>

      {/* School Switcher Modal */}
      <SchoolSwitcher isOpen={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </header>
  );
};

export default TopBar;
