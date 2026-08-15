import React from 'react';
import { Button } from './Button';
import { FolderOpen, Users, ScanLine, BellOff, School } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  icon?: React.ReactNode;
  kind?: 'roster' | 'scans' | 'queue' | 'schools' | 'default' | 'notifications' | 'generic' | string;
  className?: string;
}

const defaultIcons: Record<string, React.ReactNode> = {
  roster: <Users className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  scans: <ScanLine className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  queue: <BellOff className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  notifications: <BellOff className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  schools: <School className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  generic: <FolderOpen className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
  default: <FolderOpen className="w-7 h-7 text-forest-700 dark:text-forest-600" strokeWidth={1.75} />,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  icon,
  kind = 'default',
  className = '',
}) => {
  const renderedIcon = icon || defaultIcons[kind] || defaultIcons.default;

  return (
    <div className={`app-card p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-lg mx-auto ${className}`}>
      <div className="w-16 h-16 rounded-2xl border border-line flex items-center justify-center bg-surface-soft shadow-2xs">
        {renderedIcon}
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="t-title text-base sm:text-lg font-bold text-ink font-display">{title}</h3>
        {description && <p className="t-body text-sm text-ink-soft leading-relaxed">{description}</p>}
      </div>

      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {actionText && onAction && (
            <Button variant="primary" size="md" onClick={onAction}>
              {actionText}
            </Button>
          )}
          {secondaryActionText && onSecondaryAction && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
