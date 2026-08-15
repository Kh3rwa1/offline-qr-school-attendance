import React from 'react';
import { Language, NetworkStatus } from '../types';
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
        <div className="flex bg-surface-soft p-1 rounded-2xl border border-line gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveView('scanner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'scanner'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'স্ক্যানার' : 'Scanner'}</span>
          </button>
          <button
            onClick={() => setActiveView('roster')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'roster'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'ছাত্র তালিকা' : 'Roster'}</span>
          </button>
          <button
            onClick={() => setActiveView('outbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all relative cursor-pointer font-display ${
              activeView === 'outbox'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'আউটবক্স' : 'Outbox'}</span>
            {pendingSyncCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-warning-600 absolute -top-0.5 -right-0.5 animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'reports'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'রিপোর্ট' : 'Reports'}</span>
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-display ${
              activeView === 'admin'
                ? 'bg-forest-700 text-white shadow-sm font-bold'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'প্রধান শিক্ষক' : 'Headmaster'}</span>
          </button>
        </div>

        {/* Network Toggle Button */}
        <button
          onClick={toggleNetworkStatus}
          className="flex items-center bg-surface border border-line px-3.5 py-2 rounded-full shadow-2xs hover:bg-surface-soft transition-colors cursor-pointer"
          title="Current network status"
        >
          {networkStatus === 'OFFLINE' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-warning-600 mr-2 animate-pulse"></div>
              <WifiOff className="w-3.5 h-3.5 text-warning-600 mr-1.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                {language === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-success-600 mr-2"></div>
              <Wifi className="w-3.5 h-3.5 text-success-600 mr-1.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                {language === 'bn' ? 'অনলাইন মোড' : 'Online Mode'}
              </span>
            </>
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          className="bg-forest-700 text-white px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-forest-800 transition-colors cursor-pointer shadow-2xs font-display"
        >
          {language === 'en' ? 'BN | বাংলা' : 'EN | English'}
        </button>
      </div>
    </header>
  );
};

export default Header;
