import React, { useState, useEffect } from 'react';
import { Language } from '../types';

interface FooterProps {
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const kolkataTime = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTimeString(kolkataTime);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
      <div>Version 1.2.4-stable-offline</div>
      <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>Storage: 4.2 MB Used (IndexedDB)</span>
        </div>
        <div>Asia/Kolkata: {timeString || '12:44:02 PM'}</div>
      </div>
    </footer>
  );
};
