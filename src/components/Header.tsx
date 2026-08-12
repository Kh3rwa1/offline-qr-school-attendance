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
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0">
          Q
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 leading-tight">
            Haripur Gov. High School
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            হরিপুর সরকারি উচ্চ বিদ্যালয়
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveView('scanner')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'scanner'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'স্ক্যানার' : 'Scanner'}</span>
          </button>
          <button
            onClick={() => setActiveView('roster')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'roster'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'ছাত্র তালিকা' : 'Roster'}</span>
          </button>
          <button
            onClick={() => setActiveView('outbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
              activeView === 'outbox'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'আউটবক্স' : 'Outbox'}</span>
            {pendingSyncCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5"></span>
            )}
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'reports'
                ? 'bg-white text-slate-800 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'রিপোর্ট' : 'Reports'}</span>
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeView === 'admin'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'প্রধান শিক্ষক' : 'Headmaster'}</span>
          </button>
        </div>

        {/* Network Toggle Button */}
        <button
          onClick={toggleNetworkStatus}
          className="flex items-center bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          title="Click to toggle simulated online/offline status"
        >
          {networkStatus === 'OFFLINE' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2 animate-pulse"></div>
              <WifiOff className="w-3.5 h-3.5 text-amber-600 mr-1.5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {language === 'bn' ? 'অফলাইন মোড' : 'Offline Mode'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></div>
              <Wifi className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {language === 'bn' ? 'অনলাইন মোড' : 'Online Mode'}
              </span>
            </>
          )}
        </button>

        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          className="bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {language === 'en' ? 'BN | বাংলা' : 'EN | English'}
        </button>
      </div>
    </header>
  );
};
