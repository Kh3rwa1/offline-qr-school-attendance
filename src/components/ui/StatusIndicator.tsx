import React from 'react';
import { Wifi, WifiOff, RefreshCw, Radio, CheckCircle, AlertTriangle } from 'lucide-react';

export type SystemStatusType = 'online' | 'offline' | 'syncing' | 'connected' | 'authorized' | 'warning' | 'error';

export interface StatusIndicatorProps {
  status: SystemStatusType;
  label?: string;
  count?: number;
  className?: string;
  onClick?: () => void;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  count,
  className = '',
  onClick,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          icon: <Wifi className="w-3.5 h-3.5 text-success-600 shrink-0" />,
          dotColor: 'bg-success-600',
          text: label || 'Online & Synchronized',
          badgeClass: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30',
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-warning-600 shrink-0" />,
          dotColor: 'bg-warning-600',
          text: label || (count !== undefined ? `${count} Pending Sync` : 'Offline Mode (Local Ledger)'),
          badgeClass: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-forest-600 animate-spin shrink-0" />,
          dotColor: 'bg-forest-600',
          text: label || 'Synchronizing Ledger…',
          badgeClass: 'bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 border-forest-200 dark:border-forest-800/40',
        };
      case 'connected':
        return {
          icon: <Radio className="w-3.5 h-3.5 text-info-600 shrink-0" />,
          dotColor: 'bg-info-600',
          text: label || 'Reader Connected',
          badgeClass: 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30',
        };
      case 'authorized':
        return {
          icon: <CheckCircle className="w-3.5 h-3.5 text-success-600 shrink-0" />,
          dotColor: 'bg-success-600',
          text: label || 'Authorized & Active',
          badgeClass: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-warning-600 shrink-0" />,
          dotColor: 'bg-warning-600',
          text: label || 'Attention Required',
          badgeClass: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-danger-600 shrink-0" />,
          dotColor: 'bg-danger-600',
          text: label || 'System Error',
          badgeClass: 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30',
        };
    }
  };

  const config = getStatusConfig();
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold font-display shadow-2xs transition-all ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-98' : ''
      } ${config.badgeClass} ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`} />
        {config.icon}
      </span>
      <span className="truncate">{config.text}</span>
    </Component>
  );
};

export default StatusIndicator;
