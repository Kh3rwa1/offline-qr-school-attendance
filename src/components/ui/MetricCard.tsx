import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { RollingNumber } from '../shared/RollingNumber';

export interface MetricCardProps {
  label: string;
  value: number | string;
  previousValue?: number | string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'forest' | 'accent' | 'warning' | 'danger';
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  icon,
  variant = 'default',
  subtitle,
  className = '',
  onClick,
}) => {
  const isNumeric = typeof value === 'number';

  const getContainerStyle = () => {
    switch (variant) {
      case 'forest':
        return 'bg-forest-900 text-white border-forest-800 shadow-md shadow-forest-900/10';
      case 'accent':
        return 'bg-surface border-forest-600/30 shadow-2xs';
      case 'warning':
        return 'bg-warning-50/50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-900/30';
      case 'danger':
        return 'bg-danger-50/50 dark:bg-danger-900/10 border-danger-200 dark:border-danger-900/30';
      case 'default':
      default:
        return 'bg-surface border-line shadow-2xs';
    }
  };

  const isForest = variant === 'forest';

  return (
    <motion.div
      whileHover={onClick ? { y: -2, scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      className={`p-5 sm:p-6 rounded-[28px] border flex flex-col justify-between transition-all select-none text-left ${getContainerStyle()} ${
        onClick ? 'cursor-pointer hover:border-forest-600' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span
          className={`text-xs sm:text-sm font-bold font-display uppercase tracking-wider ${
            isForest ? 'text-emerald-300' : 'text-ink-muted'
          }`}
        >
          {label}
        </span>

        {icon && (
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isForest
                ? 'bg-forest-800 text-emerald-300'
                : 'bg-surface-soft border border-line text-forest-700 dark:text-forest-500'
            }`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <div
            className={`text-3xl sm:text-4xl font-extrabold font-display tracking-tight ${
              isForest ? 'text-white' : 'text-ink'
            }`}
          >
            {isNumeric ? <RollingNumber value={value as number} /> : value}
          </div>

          {trend && (
            <div
              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                trend.direction === 'up'
                  ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                  : trend.direction === 'down'
                  ? 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                  : 'bg-surface-soft text-ink-muted border border-line'
              }`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3 text-success-600" />
              ) : trend.direction === 'down' ? (
                <TrendingDown className="w-3 h-3 text-danger-600" />
              ) : null}
              <span>{trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}</span>
            </div>
          )}
        </div>

        {subtitle && (
          <p
            className={`text-xs ${
              isForest ? 'text-emerald-200/80' : 'text-ink-muted'
            } leading-relaxed`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default MetricCard;
