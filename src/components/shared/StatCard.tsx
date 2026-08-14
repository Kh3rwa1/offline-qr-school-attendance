import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string | React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'hero-forest' | 'default' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'cyan' | 'rose';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  onClick,
}) => {
  const isHero = variant === 'hero-forest' || variant === 'emerald';

  if (isHero) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        onClick={onClick}
        className="hero-forest-card p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between cursor-pointer select-none group"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-emerald-200/90 font-display">{title}</p>
          <motion.div 
            whileHover={{ rotate: 45 }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs backdrop-blur-xs group-hover:bg-white/20 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
          </motion.div>
        </div>

        <div className="my-4">
          <motion.span 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="text-4xl sm:text-5xl font-extrabold text-white font-display tracking-tight inline-block"
          >
            {value}
          </motion.span>
        </div>

        <div className="flex items-center gap-2">
          {trend ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              <span className="text-[10px]">▲</span> {trend.value}
            </span>
          ) : (
            <span className="text-xs text-emerald-200/80 font-medium">{subtitle || 'Active in cluster'}</span>
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
      className="app-card p-6 sm:p-7 flex flex-col justify-between cursor-pointer select-none group"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 font-display">{title}</p>
        <motion.div 
          whileHover={{ rotate: 45 }}
          className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-[#144e39] group-hover:text-white group-hover:border-[#144e39] transition-all"
        >
          <ArrowUpRight className="w-4 h-4" />
        </motion.div>
      </div>

      <div className="my-4">
        <motion.span 
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-display tracking-tight inline-block"
        >
          {value}
        </motion.span>
      </div>

      <div className="flex items-center gap-2">
        {trend ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {trend.value}
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-medium">{subtitle || 'Updated today'}</span>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
