import React from 'react';
import { Language, NetworkStatus } from '../types';
import { translate } from '../i18n';
import { Wifi, WifiOff, Users, QrCode, RefreshCw, FileText, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  networkStatus: NetworkStatus;
  toggleNetworkStatus: () => void;
  activeView: 'scanner' | 'roster' | 'outbox' | 'reports' | 'admin';
  setActiveView: (view: 'scanner' | 'roster' | 'outbox' | 'reports' | 'admin') => void;
  pendingSyncCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  setLanguage,
  networkStatus,
  toggleNetworkStatus,
  activeView,
  setActiveView,
  pendingSyncCount,
}) => {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-forest-700 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-forest-700/20 shrink-0 font-display">
          Q
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink leading-tight font-display">
            Haripur Gov. High School
          </h1>
          <p className="text-sm text-ink-soft font-medium">
            হরিপুর সরকারি উচ্চ বিদ্যালয়
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        {/* Navigation Tabs */}
        <div className="flex bg-surface-soft p-1 rounded-2xl border border-line gap-1 text-sm font-semibold">
          <button
            onClick={() => setActiveView('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'scanner'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{translate('headerScanner', language)}</span>
          </button>
          <button
            onClick={() => setActiveView('roster')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'roster'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{translate('headerRoster', language)}</span>
          </button>
          <button
            onClick={() => setActiveView('outbox')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl transition-all relative cursor-pointer font-display ${
              activeView === 'outbox'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>{translate('headerOutbox', language)}</span>
            {pendingSyncCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-warning-600 absolute -top-0.5 -right-0.5 animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'reports'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{translate('headerReports', language)}</span>
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'admin'
                ? 'bg-forest-700 text-white shadow-sm font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{translate('headerSchoolAdmin', language)}</span>
          </button>
        </div>

        {/* Network Toggle Button */}
        <button
          onClick={toggleNetworkStatus}
          className="flex items-center bg-surface border border-line px-4 py-2.5 min-h-[44px] rounded-full shadow-2xs hover:bg-surface-soft transition-colors cursor-pointer"
          title="Current network status"
        >
          {networkStatus === 'OFFLINE' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-warning-600 mr-2 animate-pulse"></div>
              <WifiOff className="w-4 h-4 text-warning-600 mr-1.5" />
              <span className="text-sm font-bold uppercase tracking-wider text-ink-soft font-display">
                {translate('offlineAttendanceMode', language)}
              </span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-success-600 mr-2"></div>
              <Wifi className="w-4 h-4 text-success-600 mr-1.5" />
              <span className="text-sm font-bold uppercase tracking-wider text-ink-soft font-display">
                {translate('statusOnline', language)}
              </span>
            </>
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          className="px-4 py-2.5 min-h-[44px] bg-surface border border-line rounded-full font-bold text-sm text-ink-soft hover:bg-surface-soft transition-colors cursor-pointer"
        >
          {translate('toggleLanguage', language)}
        </button>
      </div>
    </header>
  );
};

export default Header;
