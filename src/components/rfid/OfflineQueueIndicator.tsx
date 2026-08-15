import React, { useState } from 'react';
import { CloudOff, Wifi, AlertCircle } from 'lucide-react';

export default function OfflineQueueIndicator({ online, depth, lastSync, age }: { online: boolean; depth: number; lastSync: Date | null; age: number }) {
  const [expanded, setExpanded] = useState(false);
  const isStale = age > 3600; // > 1 hour

  return (
    <div className="relative" onClick={() => setExpanded(!expanded)}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-display cursor-pointer transition-colors ${
        online && depth === 0 ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' :
        !online || isStale ? 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30' :
        'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
      }`}>
        {online ? <Wifi className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
        {depth > 0 && <span className="bg-surface/70 px-2 py-0.5 rounded-full font-mono">{depth}</span>}
        {isStale && <AlertCircle className="w-4 h-4 text-danger-600 animate-pulse" />}
      </div>

      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-64 app-card p-4 shadow-xl z-50 text-xs text-left">
          <div className="font-extrabold font-display mb-2 border-b border-line pb-2 text-ink">Offline Sync Status</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="text-ink-muted">Network:</div>
            <div className={`font-bold ${online ? 'text-forest-700 dark:text-forest-600' : 'text-danger-800'}`}>{online ? 'Connected' : 'Disconnected'}</div>
            <div className="text-ink-muted">Queue Depth:</div>
            <div className="font-mono font-bold text-ink">{depth} events</div>
            <div className="text-ink-muted">Last Sync:</div>
            <div className="font-mono text-ink">{lastSync ? lastSync.toLocaleTimeString() : 'Never'}</div>
            <div className="text-ink-muted">Oldest Event:</div>
            <div className={`font-mono ${isStale ? 'text-danger-800 font-bold' : 'text-ink'}`}>{age > 0 ? `${Math.floor(age/60)}m ago` : 'N/A'}</div>
          </div>
          {isStale && <div className="text-xs bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30 p-2.5 rounded-xl font-medium">Warning: Local roster and offline queue may be stale. Reconnect to network immediately.</div>}
        </div>
      )}
    </div>
  );
}
