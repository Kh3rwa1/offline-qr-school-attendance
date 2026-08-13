import React, { useState } from 'react';
import { CloudOff, Wifi, AlertCircle } from 'lucide-react';

export default function OfflineQueueIndicator({ online, depth, lastSync, age }: { online: boolean; depth: number; lastSync: Date | null; age: number }) {
  const [expanded, setExpanded] = useState(false);
  const isStale = age > 3600; // > 1 hour

  return (
    <div className="relative" onClick={() => setExpanded(!expanded)}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
        online && depth === 0 ? 'bg-emerald-50 text-emerald-700' :
        !online || isStale ? 'bg-rose-50 text-rose-700' :
        'bg-amber-50 text-amber-700'
      }`}>
        {online ? <Wifi className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
        {depth > 0 && <span className="bg-white/50 px-1.5 py-0.5 rounded-md">{depth}</span>}
        {isStale && <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />}
      </div>

      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 text-white p-4 rounded-xl shadow-xl z-50 text-sm">
          <div className="font-bold mb-2 border-b border-slate-700 pb-2">Offline Sync Status</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-slate-400">Network:</div>
            <div className={online ? 'text-emerald-400' : 'text-rose-400'}>{online ? 'Connected' : 'Disconnected'}</div>
            <div className="text-slate-400">Queue Depth:</div>
            <div>{depth} events</div>
            <div className="text-slate-400">Last Sync:</div>
            <div>{lastSync ? lastSync.toLocaleTimeString() : 'Never'}</div>
            <div className="text-slate-400">Oldest Event:</div>
            <div className={isStale ? 'text-rose-400 font-bold' : ''}>{age > 0 ? `${Math.floor(age/60)}m ago` : 'N/A'}</div>
          </div>
          {isStale && <div className="text-xs bg-rose-900/50 text-rose-200 p-2 rounded">Warning: Local roster and offline queue may be stale. Reconnect to network immediately.</div>}
        </div>
      )}
    </div>
  );
}
