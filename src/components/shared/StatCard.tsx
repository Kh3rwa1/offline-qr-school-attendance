import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { RollingNumber } from './RollingNumber';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'hero-forest' | 'default' | 'emerald';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  onClick,
  className = '',
}) => {
  const isHero = variant === 'hero-forest' || variant === 'emerald';
  const isNumeric = typeof value === 'number';

  if (isHero) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        onClick={onClick}
        className={`hero-forest-card bg-forest-800 text-white p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between cursor-pointer select-none group ${className}`}
      >
        <div className="flex items-center justify-between">
          <p className="t-label text-emerald-100 tracking-wider font-display">{title}</p>
          <motion.div
            whileHover={{ rotate: 45 }}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs backdrop-blur-xs group-hover:bg-white/25 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
          </motion.div>
        </div>

        <div className="my-4">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="text-4xl sm:text-5xl font-extrabold text-white font-display tracking-tight inline-block t-data"
          >
            {isNumeric ? <RollingNumber value={value as number} /> : value}
          </motion.div>
        </div>

        <div className="flex items-center gap-2">
          {trend ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-800 text-white border border-emerald-400/50 font-display">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{trend.value}</span>
            </span>
          ) : (
            <span className="text-xs text-emerald-100 font-medium">{subtitle || 'Active in cluster'}</span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      onClick={onClick}
      className={`app-card p-6 sm:p-7 flex flex-col justify-between cursor-pointer select-none group ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="t-label text-ink-soft tracking-wider font-display">{title}</p>
        <motion.div
          whileHover={{ rotate: 45 }}
          className="w-8 h-8 rounded-full border border-line flex items-center justify-center text-ink-soft group-hover:bg-forest-700 group-hover:text-white group-hover:border-forest-700 transition-all shadow-2xs"
        >
          <ArrowUpRight className="w-4 h-4" />
        </motion.div>
      </div>

      <div className="my-4">
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="text-4xl sm:text-5xl font-extrabold text-ink font-display tracking-tight inline-block t-data"
        >
          {isNumeric ? <RollingNumber value={value as number} /> : value}
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        {trend ? (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border font-display ${
              trend.isPositive !== false
                ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                : 'bg-surface-soft text-ink-soft border-line'
            }`}
          >
            {trend.isPositive !== false ? <TrendingUp className="w-3 h-3 text-success-600" /> : <TrendingDown className="w-3 h-3 text-ink-soft" />}
            <span>{trend.value}</span>
          </span>
        ) : (
          <span className="text-xs text-ink-soft font-medium">{subtitle || 'Updated today'}</span>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
