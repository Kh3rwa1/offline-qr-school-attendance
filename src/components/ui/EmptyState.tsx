import React from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[28px] bg-surface border border-line shadow-2xs ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-line flex items-center justify-center text-forest-700 dark:text-forest-500 mb-4 shadow-sm">
        {icon || <Inbox className="w-7 h-7" strokeWidth={1.75} />}
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-ink font-display mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-ink-soft max-w-md leading-relaxed mb-6">
          {description}
        </p>
      )}

      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionText && (
            <Button variant="primary" size="md" onClick={onAction}>
              {actionText}
            </Button>
          )}
          {secondaryActionText && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default EmptyState;
