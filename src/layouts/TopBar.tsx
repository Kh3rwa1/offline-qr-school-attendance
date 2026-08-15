import React, { useState, useEffect } from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../app/OfflineStatusProvider';
import { SchoolSwitcher } from './SchoolSwitcher';
import { Search, Bell, Mail, School, RefreshCw, ChevronDown, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';

export const TopBar: React.FC = () => {
  const { user, activeRole } = useSession();
  const { activeSchoolName } = useActiveSchool();
  const { isOnline, outboxCount, isSyncing, syncNow } = useOfflineStatus();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('attendease-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('attendease-theme', 'light');
    }
  };

  return (
    <header className="h-20 bg-transparent px-6 sm:px-8 flex items-center justify-between border-b border-line">
      {/* Left: Rounded Pill Search Input */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, class, or roll number…"
            className="w-full pl-11 pr-14 py-2.5 bg-surface-soft border border-line rounded-full text-xs font-medium text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 transition-all outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-muted bg-surface border border-line px-2 py-0.5 rounded-lg shadow-2xs font-mono">
            ⌘ F
          </span>
        </div>
      </div>

      {/* Right: Quick School Switcher, Dark Mode Toggle, Notification Bells, User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* School Tenant Switcher Pill */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSwitcherOpen(true)}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink hover:bg-surface transition-all cursor-pointer shadow-2xs"
        >
          <School className="w-4 h-4 text-forest-700 dark:text-forest-600 shrink-0" />
          <span className="max-w-44 truncate">{activeSchoolName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
        </motion.button>

        {/* Sync Telemetry Badge */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing}
          aria-label="Synchronize outbox"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-soft border border-line hover:bg-surface transition-all text-xs font-semibold cursor-pointer shadow-2xs"
        >
          {isOnline ? (
            <span className="w-2 h-2 rounded-full bg-success-600 animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-warning-600 animate-pulse"></span>
          )}
          <span className="text-ink-soft text-[11px] font-mono tabular-nums">
            {isSyncing ? 'Syncing…' : `${outboxCount} unsynced`}
          </span>
          <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${isSyncing ? 'animate-spin' : ''}`} />
        </motion.button>

        {/* Dark Mode Toggle */}
        <motion.button
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-soft hover:bg-surface-soft hover:text-ink transition-all shadow-2xs cursor-pointer"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-warning-600" />
          ) : (
            <Moon className="w-4 h-4 text-ink-soft" />
          )}
        </motion.button>

        {/* Icon Action Buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.08, y: -1 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Messages"
            className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-soft hover:bg-surface-soft hover:text-ink transition-all shadow-2xs cursor-pointer"
          >
            <Mail className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08, y: -1 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Notifications"
            className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-soft hover:bg-surface-soft hover:text-ink transition-all shadow-2xs relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-forest-600 absolute top-2.5 right-2.5 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-forest-600 absolute top-2.5 right-2.5"></span>
          </motion.button>
        </div>

        {/* User Profile Info */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 pl-2 cursor-pointer select-none"
        >
          <div className="w-10 h-10 rounded-full bg-forest-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-forest-700/20 font-display">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-ink leading-tight font-display">{user?.fullName || 'Administrator'}</span>
            <span className="text-[11px] font-medium text-ink-muted">{user?.phoneNumber || activeRole || 'Active Member'}</span>
          </div>
        </motion.div>
      </div>

      {/* School Switcher Modal */}
      <SchoolSwitcher isOpen={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </header>
  );
};

export default TopBar;
