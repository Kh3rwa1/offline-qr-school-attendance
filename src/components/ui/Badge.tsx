import React from 'react';

export type BadgeVariant = 'forest' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  forest: {
    container: 'bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 border-forest-200 dark:border-forest-800/40',
    dot: 'bg-forest-600',
  },
  success: {
    container: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30',
    dot: 'bg-success-600',
  },
  warning: {
    container: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
    dot: 'bg-warning-600',
  },
  danger: {
    container: 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30',
    dot: 'bg-danger-600',
  },
  info: {
    container: 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30',
    dot: 'bg-info-600',
  },
  neutral: {
    container: 'bg-surface-soft text-ink-soft border-line',
    dot: 'bg-ink-muted',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-xs font-semibold',
  lg: 'px-3.5 py-1.5 text-sm font-semibold',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  className = '',
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-display tracking-normal select-none ${styles.container} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};

export default Badge;
