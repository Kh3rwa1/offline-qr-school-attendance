import React from 'react';
import { Button } from './Button';
import { FolderOpen, Users, ScanLine, BellOff, School } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  kind?: 'roster' | 'scans' | 'queue' | 'schools' | 'default' | 'notifications' | 'generic' | string;
  className?: string;
}

const defaultIcons: Record<string, React.ReactNode> = {
  roster: <Users className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  scans: <ScanLine className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  queue: <BellOff className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  notifications: <BellOff className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  schools: <School className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  generic: <FolderOpen className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  default: <FolderOpen className="w-6 h-6 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
  kind = 'default',
  className = '',
}) => {
  const renderedIcon = icon || defaultIcons[kind] || defaultIcons.default;

  return (
    <div className={`app-card p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto ${className}`}>
      {/* Dashed-border circular container */}
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-line flex items-center justify-center bg-surface-soft shadow-2xs">
        {renderedIcon}
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="t-title text-base font-bold text-ink">{title}</h3>
        <p className="t-body text-xs text-ink-soft leading-relaxed">{description}</p>
      </div>

      {actionText && onAction && (
        <div className="pt-2">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
