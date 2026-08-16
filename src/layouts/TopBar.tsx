import React, { useState, useEffect } from 'react';
import { useSession } from '../app/SessionProvider';
import { useActiveSchool } from '../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../app/OfflineStatusProvider';
import { useLanguage } from '../app/LanguageProvider';
import { SchoolSwitcher } from './SchoolSwitcher';
import {
  Search,
  Bell,
  School,
  RefreshCw,
  ChevronDown,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Drawer, ConfirmationDialog, Badge } from '../components/ui';

export const TopBar: React.FC = () => {
  const { user, activeRole, logout } = useSession();
  const { activeSchoolName } = useActiveSchool();
  const { isOnline, outboxCount, isSyncing, syncNow, lastSyncedAt } = useOfflineStatus();
  const { language, setLanguage, t } = useLanguage();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

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

  const handleLogout = async () => {
    setConfirmLogoutOpen(false);
    setAccountMenuOpen(false);
    await logout();
  };

  return (
    <header className="h-16 sm:h-20 bg-transparent px-4 sm:px-8 flex items-center justify-between border-b border-line gap-2 sm:gap-4 relative z-20">
      {/* Left: Search Bar (Desktop) / Mobile Compact School Name */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {/* Mobile School Name Pill */}
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="flex md:hidden items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface-soft border border-line text-sm font-bold text-ink max-w-[170px] truncate shadow-2xs cursor-pointer active:scale-95 transition-all min-h-[44px]"
        >
          <School className="w-4 h-4 text-forest-700 dark:text-forest-500 shrink-0" />
          <span className="truncate">{activeSchoolName}</span>
          <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
        </button>

        {/* Desktop Search */}
        <div className="hidden md:block relative w-full">
          <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchTopBarPlaceholder')}
            className="w-full pl-11 pr-14 py-2.5 bg-surface-soft border border-line rounded-full text-sm font-medium text-ink placeholder:text-ink-muted focus:bg-surface focus:border-forest-700 transition-all outline-none min-h-[44px]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-muted bg-surface border border-line px-2 py-0.5 rounded-lg shadow-2xs font-mono">
            ⌘ F
          </span>
        </div>
      </div>

      {/* Right: Actions, Sync Telemetry, Account Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Desktop School Tenant Switcher Pill */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSwitcherOpen(true)}
          className="hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-sm font-bold text-ink hover:bg-surface transition-all cursor-pointer shadow-2xs min-h-[44px]"
        >
          <School className="w-4 h-4 text-forest-700 dark:text-forest-500 shrink-0" />
          <span className="max-w-44 truncate">{activeSchoolName}</span>
          <ChevronDown className="w-4 h-4 text-ink-muted" />
        </motion.button>

        {/* Sync Telemetry Badge (Mobile: Compact Pill, Desktop: Detailed Pill) */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSyncDrawerOpen(true)}
          aria-label="Synchronization telemetry status"
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-soft border border-line hover:bg-surface transition-all text-sm font-semibold cursor-pointer shadow-2xs min-h-[44px]"
        >
          {isOnline ? (
            <Wifi className="w-4 h-4 text-success-600 shrink-0" />
          ) : (
            <WifiOff className="w-4 h-4 text-warning-600 shrink-0" />
          )}

          {outboxCount > 0 ? (
            <span className="bg-warning-500 text-white text-sm font-bold px-2 py-0.5 rounded-full font-mono">
              {outboxCount}
            </span>
          ) : (
            <span className="hidden sm:inline text-ink-soft text-sm font-mono">
              {isSyncing ? t('syncStatusSyncing') : t('statusSynced')}
            </span>
          )}

          <RefreshCw
            className={`w-4 h-4 text-ink-muted ${
              isSyncing ? 'animate-spin text-forest-600' : ''
            }`}
          />
        </motion.button>

        {/* Language Switcher Pill */}
        <div className="inline-flex rounded-full bg-surface-soft border border-line p-1" role="group" aria-label="Language selection">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            title="English"
            aria-label="English"
            className={`px-3.5 py-2 rounded-full text-sm font-bold font-display transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
              language === 'en'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('bn')}
            title="বাংলা + English"
            aria-label="বাংলা + English"
            className={`px-3.5 py-2 rounded-full text-sm font-bold font-display transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
              language === 'bn'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            বাং + EN
          </button>
        </div>

        {/* Dark Mode Toggle */}
        <motion.button
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-soft hover:bg-surface-soft hover:text-ink transition-all shadow-2xs cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-warning-600" />
          ) : (
            <Moon className="w-5 h-5 text-ink-soft" />
          )}
        </motion.button>

        {/* Notifications Icon (Desktop) */}
        <motion.button
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Notifications"
          className="hidden sm:flex w-10 h-10 rounded-full bg-surface border border-line items-center justify-center text-ink-soft hover:bg-surface-soft hover:text-ink transition-all shadow-2xs relative cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
        >
          <Bell className="w-5 h-5" />
          <span className="w-2.5 h-2.5 rounded-full bg-forest-600 absolute top-2.5 right-2.5 animate-ping" />
          <span className="w-2.5 h-2.5 rounded-full bg-forest-600 absolute top-2.5 right-2.5" />
        </motion.button>

        {/* User Account Menu Dropdown Anchor */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            aria-expanded={accountMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2.5 pl-1 sm:pl-2 cursor-pointer select-none outline-none min-h-[44px]"
          >
            <div className="w-10 h-10 rounded-full bg-forest-700 text-white flex items-center justify-center text-base font-bold shadow-md shadow-forest-700/20 font-display">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-sm font-bold text-ink leading-tight font-display">
                {user?.fullName || 'Administrator'}
              </span>
              <span className="text-sm font-medium text-ink-muted">
                {user?.phoneNumber || activeRole || 'Active'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-ink-muted hidden sm:block" />
          </motion.button>

          {/* Account Popover Menu */}
          <AnimatePresence>
            {accountMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAccountMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-64 bg-surface rounded-2xl border border-line shadow-xl z-50 p-2 text-left"
                >
                  <div className="p-3 border-b border-line space-y-1">
                    <p className="text-sm font-bold text-ink truncate font-display">
                      {user?.fullName || 'User'}
                    </p>
                    <p className="text-sm text-ink-muted font-mono truncate">
                      {user?.phoneNumber || 'No phone'}
                    </p>
                    <Badge variant="forest" size="sm" className="mt-1">
                      {activeRole || 'STAFF'}
                    </Badge>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setSwitcherOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-surface-soft rounded-xl transition-colors text-left cursor-pointer min-h-[44px]"
                    >
                      <School className="w-4 h-4 text-forest-700" />
                      <span>{t('switchSchool')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setSyncDrawerOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-surface-soft rounded-xl transition-colors text-left cursor-pointer min-h-[44px]"
                    >
                      <RefreshCw className="w-4 h-4 text-forest-700" />
                      <span>{t('syncDrawerTitle')}</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setConfirmLogoutOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-bold text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-xl transition-colors text-left cursor-pointer min-h-[44px]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* School Switcher Modal */}
      <SchoolSwitcher isOpen={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      {/* Synchronization Bottom Sheet Drawer */}
      <Drawer
        isOpen={syncDrawerOpen}
        onClose={() => setSyncDrawerOpen(false)}
        title={t('syncDrawerTitle')}
        description={t('syncDrawerDesc')}
        placement="bottom"
      >
        <div className="space-y-5 text-left max-w-lg mx-auto">
          {/* Status Banner */}
          <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isOnline
                    ? 'bg-success-50 text-success-600 border border-success-100 dark:border-success-600/30'
                    : 'bg-warning-50 text-warning-600 border border-warning-100 dark:border-warning-600/30'
                }`}
              >
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink">
                  {isOnline ? t('internetConnected') : t('offlineAttendanceMode')}
                </h4>
                <p className="text-sm text-ink-muted">
                  {isOnline ? t('connectedToServer') : t('operatingLocally')}
                </p>
              </div>
            </div>

            <Badge variant={isOnline ? 'success' : 'warning'} size="sm" dot pulse>
              {isOnline ? t('statusOnline') : t('statusOffline')}
            </Badge>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-surface-soft border border-line">
              <span className="text-sm text-ink-muted uppercase font-bold tracking-wider font-display">
                {t('syncStatusWaiting')}
              </span>
              <div className="text-2xl font-extrabold text-ink font-mono mt-1">
                {outboxCount}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-soft border border-line">
              <span className="text-sm text-ink-muted uppercase font-bold tracking-wider font-display">
                {t('storageStatus')}
              </span>
              <div className="text-sm font-bold text-forest-700 dark:text-forest-400 mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('storageGuaranteed')}</span>
              </div>
            </div>
          </div>

          {lastSyncedAt && (
            <p className="text-sm text-ink-muted text-center font-mono">
              {t('lastSyncedAtLabel')} {new Date(lastSyncedAt).toLocaleTimeString('en-IN')}
            </p>
          )}

          {/* Sync Button */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={async () => {
                await syncNow();
              }}
              disabled={!isOnline || isSyncing}
              isLoading={isSyncing}
              leftIcon={<RefreshCw className="w-5 h-5" />}
              className="w-full text-base font-bold shadow-lg shadow-forest-700/20 min-h-[48px] rounded-2xl font-display"
            >
              {isSyncing ? t('sendingRecords') : t('sendRecordsNow')}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Confirmation Dialog: Sign Out */}
      <ConfirmationDialog
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={handleLogout}
        title={t('logOutConfirmTitle')}
        description={t('logOutConfirmDesc')}
        confirmText={t('logout')}
        cancelText={t('staySignedIn')}
        intent="danger"
      />
    </header>
  );
};

export default TopBar;
